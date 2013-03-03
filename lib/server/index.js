
var http = require('http');
var fs = require('fs');
var url = require('url');
var path = require('path');
var socket_io = require('socket.io');
var mime = require('mime');
var zlib = require('zlib');
var crypto = require('crypto');
var httpProxy = require('http-proxy');

var html_ast_tools = require('../ast/html');
var files = require('./modules/files');

var moduleOptions = require('./options');
var command = moduleOptions.command;

//
// export
//

exports.launch = launch;
exports.options = moduleOptions;
exports.command = function(args, config){
  return command(args, config, launch);
};

//
// if launched directly, launch server
//

if (process.mainModule === module)
  command(null, true, launch);

//
// main function
//

function launch(options){

  options = moduleOptions.norm(options);

  var BASE_PATH = options.base;

  // settings
  var readExtensions = ['.css', '.tmpl', '.txt', '.json', '.js'];
  var notifyExtensions = ['.css', '.tmpl', '.txt', '.json'];
  var hotStartExtensions = ['.css', '.tmpl', '.json', '.js'];
  var ignorePathes = options.ignore;
  var rewriteRules = [];
  var fileMap = {};
  var proxy;
  var hasSocketClients = false;
  var contentHandlers;

  // check base path
  if (!fs.existsSync(BASE_PATH))
  {
    console.warn('Base path `' + BASE_PATH + '` not found');
    process.exit();
  }

  if (options.rewrite)
  {
    for (var key in options.rewrite)
    {
      var part = 'pathname';
      var rx = key.replace(/^(host|hostname|port|path|pathname|href):/, function(m, name){
        part = name;
        return '';
      });
      rewriteRules.push({
        msg: '/' + key + '/ -> ' + options.rewrite[key],
        re: new RegExp(rx),
        url: options.rewrite[key],
        part: part
      });
    }
  }

  if (Array.isArray(options.handler))
  {
    contentHandlers = [];
    for (var i = 0; i < options.handler.length; i++)
    {
      var handlerPath = options.handler[i];

      console.log('[HANDLER] ' + handlerPath);

      try {
        var handler = require(handlerPath);

        if (typeof handler.process == 'function')
          contentHandlers.push(handler.process);
        else
          console.log('[ERROR] Preprocessor has no process function. Skipped.');
      } catch(e) {
        console.log('[ERROR] Error on preprocessor load: ' + e);
      }
    }
  }


  //
  // Proxy
  //
  function rewriteRequest(req, res, loc){
    for (var i = 0, rule; rule = rewriteRules[i]; i++)
    {
      var pathmatch = loc[rule.part].match(rule.re);
      // console.log(rule.part, loc);
      // console.log('match:', pathmatch, loc[rule.part], rule.re);
      // console.log(rule.url);
      if (pathmatch)
      {
        var ruleParts = rule.url.trim().split(/\s+/);
        var ruleUrl = ruleParts.shift();
        var args = ruleParts.join(' ').toUpperCase().replace(/^\[|\]$/g, '').split(/\s*\,\s*/);
        var location = url.parse(ruleUrl.replace(/\$(\d+)/g, function(m, n){
          return n in pathmatch ? pathmatch[n] || '' : m;
        }));

        for (var key in loc)
          if ((key == 'host' || key == 'hostname' || key == 'port') && key in location == false)
            location[key] = loc[key];

        //console.log(location);
        var responseCode;
        for (var i = 0; i < args.length; i++)
          if (args[i].match(/^R(\d{3}|)$/))
            responseCode = RegExp.$1 || 307;

        if (loc.host == location.host && !responseCode)
        {
          // internal url changes
          console.log('[REWRITE]', loc.href, '->', location.href)
          loc = location;
        }
        else
        {
          if (args.indexOf('P') !== -1)
          {
            if (!proxy)
            {
              proxy = new httpProxy.HttpProxy({
                changeOrigin: true,
                target: {
                  host: 'localhost',
                  port: 80
                }
              });
            }

            // prozy request
            proxy.target.host = location.hostname;
            proxy.target.port = location.port || 80;
            req.url = location.path;

            console.log('[REWRITE] proxy request:\n    ' + loc.href + '\n  ->\n    ' + location.href);
            proxy.proxyRequest(req, res);
          }
          else
          {
            if (!responseCode)
              responseCode = 307;

            if (responseCode == 301 || responseCode == 302 || responseCode == 303 || responseCode == 307 || responseCode == 308)
            {
              console.log('[REWRITE] ' + loc.href + ' redirect to ' + location.href, responseCode);
              res.writeHead(responseCode, {
                Location: location.href
              });
              res.end();
            }
            else
            {
              console.log('[REWRITE] ' + loc.href, responseCode);
              res.writeHead(responseCode);
              res.end('Response code ' + responseCode);
            }
          }

          return false;
        }
      }
    }
    return loc;
  }

  //
  // Cache
  //
  var hotStartCache = (function(){
    var cache = {};
    var content;
    var invalidate = false;

    function contentDigest(content){
      var hash = crypto.createHash('md5');
      hash.update(content);
      return hash.digest('base64')
        // remove trailing == which always appear on md5 digest, save 2 bytes
        .replace(/=+$/, '')
        // make digest web safe
        .replace(/\//g, '_')
        .replace(/\+/g, '-');
    }

    function rebuild(){
      var raw = JSON.stringify(cache, null, 2);
      content = new String(raw);
      content.mtime = new Date;
      //content.digest = contentDigest(raw);
      console.log('[CACHE] rebuild');
    }

    rebuild();

    return {
      isRequire: function(fnKey){
        return cache.hasOwnProperty(fnKey);
      },
      add: function(fnKey, content){
        if (cache[fnKey] !== content)
        {
          console.log('[CACHE] ' + (fnKey in cache ? 'update ' : 'add ') + fnKey);
          cache[fnKey] = content;

          invalidate = true;
        }
      },
      remove: function(fnKey){
        if (fnKey in cache)
        {
          console.log('[CACHE] remove ' + fnKey);
          delete cache[fnKey];

          invalidate = true;
        }
      },
      get: function(){
        if (invalidate)
        {
          invalidate = false;
          rebuild();
        }

        return content;
      }
    }
  })();


  //
  // Path resolving
  //
  var resCacheFile = {};
  var virtualPath = {
    '/__basis_resources__.js': function(req, res){
      var content = hotStartCache.get();
      if (!contentIsNotModified(req, res, content.mtime))
      {
        console.log('[CLIENT]', '/__basis_resources__.js', '(from cache)');
        responseToClient(res, 'window.__resources__ = ' + content, {
          contentType: 'text/javascript',
          mtime: content.mtime,
          file: resCacheFile,
          encoding: resolveEncoding(req)/*,
          expires: 1 // 1 min*/
        });
      }
      else
        console.log('[CLIENT]', '/__basis_resources__.js', '304');
    }
  };

  function resolvePathnameFile(req, res, filename, location){
    var fnKey = normPath(filename);

    if (virtualPath.hasOwnProperty(fnKey))
      return virtualPath[fnKey](req, res);

    if (fnKey == '/favicon.ico' && !fs.existsSync(filename))
      return __dirname + '/assets/favicon.ico';

    if (!fs.existsSync(filename))
    {
      console.log('[CLIENT]', location.pathname, '404');
        
      res.writeHead(404);
      res.end('File ' + filename + ' not found');

      return false;
    }

    var fileStat = fs.statSync(filename);
    if (fileStat.isDirectory())
    {
      if (!/\/$/.test(location.pathname))
      {
        console.log('[CLIENT]', location.pathname, 'redirect to', location.pathname + '/');

        res.writeHead(301, {
          Location: location.pathname + '/'
        });
        res.end();

        return false;
      }

      if (fs.existsSync(filename + '/index.html'))
        return filename + '/index.html';

      if (fs.existsSync(filename + '/index.htm'))
        return filename + '/index.htm';

      console.log('[CLIENT]', location.pathname, '404');
      res.writeHead(404);
      res.end('Path ' + filename + ' is not a file');
      return false;
    }

    return {
      filename: filename
    };
  }

  function contentIsNotModified(req, res, date){
    if (req.headers['if-modified-since'])
    {
      var headerDate = parseInt(new Date(req.headers['if-modified-since']) / 1000);
      var contentDate = parseInt(date / 1000);
      if (isNaN(headerDate))
      {
        console.log('[WARN] Invalid date in If-Modified-Since header');
        headerDate = Infinity; // most cheapest way response with no changed
      }

      if (headerDate >= contentDate)
      {
        res.writeHead(304, {
          'Last-Modified': date.toGMTString()
        });
        res.end();
        return true;
      }
    }
  }

  function responseToClient(res, content, options){
    var headers = {
      'Content-Type': options.contentType || 'application/octet-stream'
    };

    if (options.mtime)
      headers['Last-Modified'] = options.mtime.toGMTString();

    if (options.expires)
    {
      headers['Cache-Control'] = 'max-age=' + options.expires;
      headers['Expires'] = (new Date(+(new Date) + (1000 * options.expires))).toGMTString();
    }

    if (options.encoding)  
    {
      headers['Content-Encoding'] = options.encoding;

      if (false && options.file && options.file.zip && options.encoding in options.file.zip
          /* FIXME: i'm a hack */ && /text\/html/.test(options.contentType))
        content = options.file.zip[options.encoding];
      else
      {
        zlib[options.encoding](content, function(er, content){
          if (er)
          {
            res.writeHead(500);
            res.end('Error while content compression: ' + er);
          }
          else
          {
            if (options.file && options.file.zip)
              options.file.zip[options.encoding] = content;

            res.writeHead(200, headers);
            res.end(content);
          }
        });
        return;
      }
    }

    res.writeHead(200, headers);
    res.end(content);
  }

  function resolveEncoding(req){
    return req.headers['accept-encoding']
      ? req.headers['accept-encoding'].toLowerCase().replace(/^.*?\b(gzip|deflate)\b.*$|.*()/, '$1$2')
      : '';
  }

  function getFileHandler(fres, fnKey, req, res, fileStat, opt){
    var filename = fres.filename;
    var contentType = mime.lookup(filename, 'text/plain');
    var textFile = /^text\/|^application\/(javascript|json|.+\+xml$)/.test(contentType);
      
    return function(err, data){
      if (err)
      {
        res.writeHead(500);
        res.end('Can\'t read file', err);
        return;
      }

      // cache file
      var file = fileMap[fnKey]
      if (!file)
        file = fileMap[fnKey] = {};

      file.fn = fnKey;
      file.touched = true;

      if (file.content != data)
      {
        file.content = data;
        file.zip = {};
      }

      // no errors
      var responseOptions = {
        contentType: contentType + (textFile ? '; charset=utf-8' : ''),
        encoding: textFile && resolveEncoding(req), // gzip, deflate
        mtime: fileStat.mtime,
        file: file,
        expires: contentType == 'text/html' ? 0 : 60 * 60 // 1 hour
      };

      if (options.cache && options.resCache
          && hotStartExtensions.indexOf(path.extname(filename)) != -1
          && ignorePathes.indexOf(path.normalize(filename)) == -1
          && (!options.dotFilenameIgnore || path.basename(filename).charAt(0) != '.'))
        hotStartCache.add(fnKey, String(data));

      if (textFile && contentHandlers)
        for (var i = 0, handler; handler = contentHandlers[i]; i++)
          data = contentHandlers[i](contentType, data, fnKey, fres) || data;

      if (contentType == 'text/html')
      {
        var fileContent = String(data);

        var ast = html_ast_tools.parse(fileContent);
        var head;
        var body;
        var firstScript;
        var firstHeadScript;

        if (fres.rewritten || options.resCache || options.sync)
        {
          html_ast_tools.walk(ast, {
            tag: function(node){
              switch (node.name){
                case 'head':
                  if (!head)
                    head = node;
                  break;

                case 'body':
                  if (!body)
                    body = node;
                  break;

                case 'script':
                  if (!firstScript)
                    firstScript = node;
                  if (!firstHeadScript && node.parent == head)
                    firstHeadScript = node;
                  break;
              }
            }
          });

          ast.head = head;
          ast.body = body;
        }

        if (fres.rewritten)
          html_ast_tools.injectToHead(ast, {
            type: 'tag',
            name: 'base',
            attribs: {
              href: '//' + req.headers.host + path.dirname(path.normalize(fnKey)) + '/'
            }
          }, true);

        if (options.resCache)
        {
          var resourceScript = {
            type: 'tag',
            name: 'script',
            attribs: {
              src: '/__basis_resources__.js'
            }
          };

          if (firstHeadScript)
            html_ast_tools.insertBefore(firstHeadScript, resourceScript);
          else
            html_ast_tools.injectToHead(ast, resourceScript);
        }

        if (options.sync)
        {
          files.readFile(__dirname + '/assets/client.js', function(err, clientFileData){
            if (!err)
              //fileContent = fileContent.replace(/<\/body>/i, '<script>' + clientFileData + '</script></body>');
              html_ast_tools.injectToBody(ast, {
                type: 'tag',
                name: 'script',
                children: [{
                  type: 'text',
                  data: clientFileData
                }]
              });

            responseToClient(res, html_ast_tools.translate(ast), responseOptions);
          });
        }
        else
          responseToClient(res, html_ast_tools.translate(ast), responseOptions);
      }
      else
      {
        responseToClient(res, data, responseOptions);
      }
    }
  }

  //
  // app control panel server
  //
  if (options.dev)
  {
    var appcp_server = require('./modules/appcp_server.js');
    appcp_server.create();
  }
  

  //
  // Server
  //
  var httpServer = http.createServer(function(req, res){
    var reqLocation = url.parse('//' + req.headers.host + req.url, true, true);
    var location = rewriteRequest(req, res, reqLocation);

    //proxy request if nececcary
    if (!location)
      return;

    // resolve filename
    var pathname = location.pathname.slice(1);
    var fres = resolvePathnameFile(req, res, path.normalize(BASE_PATH + location.pathname), location);

    if (typeof fres == 'string')
      fres = {
        filename: fres
      };


    if (fres)
    {
      var filename = fres.filename;
      var fileStat = fs.statSync(filename);
      var fnKey = normPath(fres.filename);
      var pathname = location.pathname + (fnKey != location.pathname ? ' -> ' + fnKey : '');
      
      fres.rewritten = reqLocation.href != location.href;

      if (options.readCache)
      {
        if (contentIsNotModified(req, res, fileStat.mtime))
        {
          console.log('[CLIENT]', pathname, '304');
          return;
        }

        if (fileMap[fnKey] && fileMap[fnKey].content != null)
        {
          console.log('[CLIENT]', pathname, '(from cache)');
          getFileHandler(fres, fnKey, req, res, fileStat, location.query)(null, fileMap[fnKey].content);
          return;
        }
      }

      console.log('[CLIENT]', pathname, '(file read)');
      files.readFile(filename, getFileHandler(fres, fnKey, req, res, fileStat, location.query));
    }
  });


  function buildIndex(){
    function readdir(dirname){
      if (ignorePathes.indexOf(path.normalize(dirname)) != -1
          && (!options.dotFilenameIgnore || path.basename(filename).charAt(0) != '.'))
        return;

      var list = fs.readdirSync(dirname);
      for (var i = 0, filename; filename = list[i]; i++)
      {
        filename = dirname + '/' + filename;

        var stat = fs.statSync(filename);
        if (stat.isDirectory())
          readdir(filename);
        else
        {
          if (hotStartExtensions.indexOf(path.extname(filename)) != -1)
            hotStartCache.add(normPath(filename), fs.readFileSync(filename, 'utf8'));
        }
      }
    }

    console.log('Base path: ', options.index);
    readdir(options.index);
  }

  //create server
  console.log('Start server');

  httpServer.listen(options.port, function(){
    var port = httpServer.address().port;

    if (options.sync)
      console.log('Watching changes for path: ' + BASE_PATH);
    else
      console.log('Watching for FS: NO');

    console.log('Ignore filenames starting with dot: ' + (options.dotFilenameIgnore ? 'YES' : 'NO'));
    if (ignorePathes && ignorePathes.length)
      console.log('Ignore pathes:\n  ' + ignorePathes.join('\n  '));

    if (rewriteRules)
      console.log('\nRewrite rules:\n  ' + rewriteRules.map(function(rule){ return rule.msg }).join('\n  '));

    if (options.index)
    {
      console.log('Build index');
      buildIndex();
      console.log('  DONE');
    }

    console.log('Server is online, listen for http://localhost:' + port);
    console.log('------------');
  });

  //
  // Messaging
  //

  if (!options.sync)
    return;

  var io = socket_io.listen(httpServer);
  io.disable('log');

  io.sockets.on('connection', function(socket){
    hasSocketClients = true;

    socket.on('saveFile', function(filename, content, callback){
      console.log('[SOCKET] request saveFile', arguments);

      var fname = path.normalize(BASE_PATH + '/' + filename);

      if (!fsWatcher.isFileObserve(fname))
        callback('file is not observing');
      else
        fs.writeFile(fname, content, function(err){
          callback(err);
        });
    });

    socket.on('createFile', function(filename, content, callback){
      console.log('[SOCKET] request createFile', arguments);

      if (typeof callback != 'function')
        callback = Function();

      var fname = BASE_PATH + '/' + filename;
       
      if (fs.existsSync(fname) || !fs.existsSync(path.dirname(fname)))
        callback('bad filename');
      else
        fs.writeFile(fname, '', function(err){
          callback(err);
        });
    });

    socket.on('readFile', function(filename, callback){
      console.log('[SOCKET] request readFile', arguments);

      var fnKey = normPath(BASE_PATH + '/' + filename);
      var fileInfo = fileMap[fnKey];

      if (fileInfo && callback)
      {
        var sendData = {
          filename: fnKey,
          lastUpdate: fileInfo.mtime,
          content: fileInfo.content
        };

        callback(sendData);
      }

      // read file only if file is unknown or never read
      if (!fileInfo || !fileInfo.touched)
        fsWatcher.readFile(BASE_PATH + '/' + filename);
    });

    socket.on('observe', function(rel, fspath){
      socket.emit('observeReady', fsWatcher.getFiles(BASE_PATH + '/'));
    });
  });

  var createCallback = function(fileInfo){
    console.log('[SOCKET] broadcast newFile');
    io.sockets.emit('newFile', fileInfo);
  }
  var updateCallback = function(fileInfo){
    console.log('[SOCKET] broadcast updateFile');
    io.sockets.emit('updateFile', fileInfo);
  }
  var deleteCallback = function(filename){
    console.log('[SOCKET] broadcast deleteFile');
    io.sockets.emit('deleteFile', normPath(filename));
  }

  function normPath(filename){
    return '/' + path.relative(BASE_PATH, path.resolve(BASE_PATH, filename)).replace(/\\/g, '/')
  }

  //
  // File System Watcher
  //

  var fsWatcher = (function(){
    var dirMap = {};
    var touchedFile = {};

    function readFile(filename){
      if (readExtensions.indexOf(path.extname(filename)) != -1)
      {
        var fnKey = normPath(filename);
        var fileInfo = fileMap[fnKey];

        fileInfo.touched = true;

        files.readFile(filename, function(err, data){
          if (!err)
          {
            console.log('[FS] file read ' + filename);
            
            var newContent = data;
            var contentChanged = newContent !== fileInfo.content;
            var newFileInfo = {
              filename: fnKey,
              lastUpdate: fileInfo.mtime
            };

            if (contentChanged)
              fileInfo.content = newContent;

            newFileInfo.content = newContent;

            if (hasSocketClients && fileInfo.notify)
              updateCallback(newFileInfo);

            if (fileInfo.hotStart && hotStartCache.isRequire(fnKey))
              hotStartCache.add(fnKey, newContent);
          }
          else
            console.log('[FS] Error: Can\'t read file ' + filename + ': ' + err);
        });
      }
      else
      {
        var file = fileMap[normPath(filename)];
        if (file && file.content != null)
        {
          console.log('drop content');
          file.content = null;
        }
      }
    }

    function updateStat(filename){
      filename = path.normalize(filename);

      fs.stat(filename, function statHandler(err, stats){
        var fnKey = normPath(filename);

        if (err)
        {
          console.log('updateStat error:', err);
        }
        else
        {
          var fileInfo = fileMap[fnKey];

          if (!fileMap[fnKey])
          {
            var fileType = stats.isDirectory() ? 'dir' : 'file';
            var ext = path.extname(filename);

            fileMap[fnKey] = {
              mtime: stats.mtime,
              type: fileType,
              hotStart: hotStartExtensions.indexOf(ext) != -1,
              notify: notifyExtensions.indexOf(ext) != -1,
              content: null
            };

            // event!! new file
            if (filename != BASE_PATH)
            {
              console.log('[FS] new -> ' + filename);

              if (hasSocketClients)
                createCallback({
                  filename: normPath(filename),
                  type: fileType,
                  lastUpdate: stats.mtime
                });
            }

            if (fileType == 'dir')
            {
              //console.log(filename, path.normalize(filename));
              if (ignorePathes.indexOf(path.normalize(filename)) == -1
                  && (!options.dotFilenameIgnore || path.basename(filename).charAt(0) != '.'))
                lookup(filename);
            }
            else
            {
              fs.watchFile(filename, { interval: 150 }, function(curr, prev){
                statHandler(null, curr);
              });
              //readFile(filename);
            }
          }
          else
          {
            if (fileMap[fnKey].type == 'file' && stats.mtime - fileMap[fnKey].mtime)
            {
              console.log('[FS] update -> ' + filename);
              fileInfo.mtime = stats.mtime;
              if (fileInfo.touched)
                readFile(filename);
            }
          }
        }
      });
    }

    function lookup(dirname){
      fs.exists(dirname, function(exists){
        if (!exists)
          return;

        fs.readdir(dirname, function(err, files){
          if (err)
            return console.log('lookup error:', dirname, err);

          var filename;
          var dirInfo = dirMap[dirname];

          updateStat(dirname);

          if (dirInfo)
          {
            var dirFiles = dirInfo.files;
            for (var i = 0, file; file = dirFiles[i++];)
            {
              if (files.indexOf(file) == -1)
              {
                var filename = path.normalize(dirname + '/' + file);
                var fnKey = normPath(filename);

                fs.unwatchFile(filename);
                delete fileMap[fnKey];
                hotStartCache.remove(fnKey);

                // event!!
                if (hasSocketClients)
                  deleteCallback(filename);

                console.log('[FS] delete -> ' + filename); // file lost
              }
            }
          }
          else
          {
            dirInfo = dirMap[dirname] = {};

            // start watching
            fs.watch(dirname, function(event, filename){
              lookup(dirname);
            });
          }

          dirInfo.files = files;

          for (var file, i = 0; file = files[i++];)
            updateStat(dirname + '/' + file);
        });
      });
    }

    lookup(BASE_PATH);

    return {
      readFile: readFile,
      getFiles: function(path){
        var result = [];

        for (var filename in fileMap)
        {
          if (filename != '/')
          {
            result.push({
              filename: filename,
              type: fileMap[filename].type,
              lastUpdate: fileMap[filename].mtime/*,
              content: null//fileMap[filename].content*/
            });
          }
        }

        return result;
      },
      isFileObserve: function(filename){
        return !!fileMap[normPath(filename)];
      }
    }

  })();
}
