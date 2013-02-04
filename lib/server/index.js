
var http = require('http');
var fs = require('fs');
var url = require('url');
var path = require('path');
var socket_io = require('socket.io');
var mime = require('mime');
var zlib = require('zlib');
var crypto = require('crypto');
var httpProxy = require('http-proxy');

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

  var fs_debug = false;

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

    if (fnKey == '/favicon.ico')
    {
      if (!fs.existsSync(filename))
        return __dirname + '/assets/favicon.ico';
    }

    var debugFilename = filename;
    filename = filename.replace(/(\.debug|-vsdoc)\.js$/i, '.js');
    var isDebug = debugFilename != filename;

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
      pathname: debugFilename,
      filename: filename,
      isDebug: isDebug
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
    return req.headers['accept-encoding'] ? req.headers['accept-encoding'].toLowerCase().replace(/^.*?\b(gzip|deflate)\b.*$|.*()/, '$1$2') : '';
  }

  function moduleWrapper(){
    var requires = [requireList_];
    var loadCount = 0;
    var loadMap = {};
    var self = namespacePath_;

    function loadDone(ns){
      var idx = self.requiresLeft_.indexOf(ns);
      if (idx != -1)
      {
        self.requiresLeft_.splice(idx, 1);
        loadCount--;
        if (!loadCount)
          run();
      }
    }

    self.requiresLeft_ = [];
    for (var i = 0; i < requires.length; i++)
    {
      basis.require(requires[i]);
      var ns = basis.namespace(requires[i]);
      if (!ns.loaded_)
      {
        self.requiresLeft_.push(requires[i]);
        loadCount++;
        if (!ns.notifyLoaded_)
          ns.notifyLoaded_ = [];
        ns.notifyLoaded_.push(loadDone);
      }
    }

    if (!loadCount)
      run();

    function run(){
      self.loaded_ = true;

      (function(exports, module, basis, global, __filename, __dirname, resource){
        moduleCode_;
      }).call(self, self.exports, self, basis, window, filename_, dirname_, function(path){
        return basis.resource(dirname_ + '/' + path);
      });
      basis.object.complete(self, self.exports);

      if (self.notifyLoaded_)
        for (var i = 0; i < self.notifyLoaded_.length; i++)
          self.notifyLoaded_[i]();
    }
  }

  function getFileHandler(fres, fnKey, req, res, fileStat, opt){
    var filename = fres.filename;
    var contentType = mime.lookup(filename, 'text/plain');
    var textFile = /^(text\/|application\/)/.test(contentType);
      
    return function(err, data){
      if (err)
      {
        res.writeHead(500);
        res.end('Can\'t read file', err);
        return;
      }

      // cache file
      if (!fileMap[fnKey])
        fileMap[fnKey] = {};

      fileMap[fnKey].fn = fnKey;

      if (fileMap[fnKey].content != data)
      {
        if (fres.isDebug)
        {
          var rx = /basis\.require\(('[^']+'|"[^"]+")\)/g;
          var list = [];
          while (m = rx.exec(data))
          {
            list.push(m[1])
          }

          data = '(' + (
            moduleWrapper.toString()
              .replace('requireList_', list.join(','))
              .replace('namespacePath_', opt.ns)
              .replace('moduleCode_', data)
              .replace('filename_', '"' + fnKey + '"')
              .replace(/dirname_/g, '"' + path.dirname(fnKey) + '"')
          ) + ')()';
        }

        fileMap[fnKey].content = data;
        fileMap[fnKey].zip = {};
      }

      // no errors
      var responseOptions = {
        contentType: contentType + (textFile ? '; charset=utf-8' : ''),
        encoding: textFile && resolveEncoding(req), // gzip, deflate
        mtime: fileStat.mtime,
        file: fileMap[fnKey],
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

      if (contentType == 'text/html' && (options.resCache || options.sync))
      {
        var fileContent = String(data);

        if (fres.rewritten)
          fileContent = fileContent.replace(/<head>((?:[\r\n]|\s)*)/i, '<head>$1<base href="//' + req.headers.host + path.dirname(path.normalize(fnKey)) + '/">$1');

        if (options.resCache)
          fileContent = fileContent.replace(/<script/i, '<script src="/__basis_resources__.js"></script><script');

        if (options.sync)
        {
          fs.readFile(__dirname + '/assets/client.js', 'utf8', function(err, clientFileData){
            if (!err)
              fileContent = fileContent.replace(/<\/body>/i, '<script>' + clientFileData + '</script></body>');

            responseToClient(res, fileContent, responseOptions);
          });
        }
        else
          responseToClient(res, fileContent, responseOptions);
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
      var fnKey = normPath(fres.pathname || fres.filename);
      var pathname = location.pathname + (fnKey != location.pathname ? ' -> ' + fnKey : '');
      var contentType = mime.lookup(filename, 'text/plain');
      var textFile = /^(text\/|application\/)/.test(contentType);
      
      fres.rewritten = reqLocation.href != location.href;

      if (fres.isDebug)
      {
        console.log('[CLIENT]', pathname, '(force file read)');
        fs.readFile(filename, getFileHandler(fres, fnKey, req, res, fileStat, location.query));
      }
      else
      {
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
        fs.readFile(filename, textFile ? 'utf8' : null, getFileHandler(fres, fnKey, req, res, fileStat, location.query));
      }
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
      console.log('Save file', arguments);

      var fname = path.normalize(BASE_PATH + '/' + filename);

      if (!fsWatcher.isObserveFile(fname))
        callback('file not observable');
      else
        fs.writeFile(fname, content, function(err){
          callback(err);
        });
    });

    socket.on('createFile', function(filename, content, callback){
      console.log('create file', arguments);

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

    socket.on('readFile', function(filename, content){
      console.log('read file', arguments);
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

    function readFile(filename){
      if (readExtensions.indexOf(path.extname(filename)) != -1)
      {
        fs.readFile(filename, 'utf8', function(err, data){
          if (!err)
          {
            console.log('[FS] file read ' + filename);
            var fnKey = normPath(filename);
            var fileInfo = fileMap[fnKey];
            var newContent = data;

            var newFileInfo = {
              filename: normPath(filename),
              lastUpdate: fileInfo.mtime
            };

            if (newContent !== fileInfo.content)
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
              readFile(filename);
            }
          }
          else
          {
            if (fileMap[fnKey].type == 'file' && stats.mtime - fileMap[fnKey].mtime)
            {
              console.log('[FS] update -> ' + filename);
              fileInfo.mtime = stats.mtime;
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
                var fileInfo = fileMap[fnKey];

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
      isObserveFile: function(filename){
        return !!fileMap[normPath(filename)];
      }
    }

  })();
}
