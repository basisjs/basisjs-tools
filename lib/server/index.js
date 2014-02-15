var fs = require('fs');
var url = require('url');
var path = require('path');
var http = require('http');
var socket_io = require('socket.io');
var mime = require('mime');
var zlib = require('zlib');
var httpProxy = require('http-proxy');
var child_process = require('child_process');
var utils = require('./modules/utils');
var chalk = require('chalk');

var html_ast_tools = require('../ast/html');
var files = require('./modules/files');
var command = require('./command');

var fsIsCaseSensetive = fs.existsSync(process.execPath.toLowerCase()) &&
                        fs.existsSync(process.execPath.toUpperCase());


//
// launched by another module
//
exports.launch = function(config){
  if (this === command)
    launch(config);
  
  if (this === exports)
    launch(command.normalize(config));
};


//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
// main function
//
function launch(config){
  var options = command.norm(config);

  utils.verbose = options.verbose;
  chalk.enabled = options.color;

  // imports
  var logMsg = utils.logMsg;
  var logWarn = utils.logWarn;
  var normPath = utils.relPathBuilder(options.base);
  var hotStartCache = require('./modules/resourceCache');

  // settings
  var hotStartExtensions = ['.css', '.tmpl', '.json', '.js', '.l10n'];
  var ignorePathes = options.ignore;
  var rewriteRules = [];
  var socketClientCount = false;
  var contentHandlers;
  var proxy;

  // check base path
  if (!fs.existsSync(options.base))
  {
    console.warn('Base path `' + options.base + '` not found');
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
        msg: chalk.green('/' + key + '/') + ' -> ' + chalk.green(options.rewrite[key]),
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

      logMsg('handler', handlerPath, true);

      try {
        var handler = require(handlerPath);

        if (typeof handler.process == 'function')
          contentHandlers.push(handler.process);
        else
          logWarn('handler', 'Preprocessor has no process function. Skipped.');
      } catch(e) {
        logWarn('handler', 'Error on preprocessor load: ' + e);
      }
    }
  }


 


  //
  // files
  //

  var fileMap = {};

  function getFileInfo(filename){
    var fnKey = normPath(filename);
    var file = fileMap[fnKey]

    if (!file)
      file = fileMap[fnKey] = {
        filename: fnKey,
        content: null
      };

    return file;
  }

  files.addReadCallback(function(err, data, filename){
    if (err)
      return logMsg('fs', 'Error: Can\'t read file ' + filename + ': ' + err);        

    var file = getFileInfo(filename);
    if (file.content != data)
    {
      file.mtime = fs.statSync(filename).mtime;
      file.content = data;
      file.zip = {};

      if (hotStartCache.has(file.filename))
        hotStartCache.add(file.filename, data);
    }
  });


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
          if ((key == 'host' || key == 'hostname' || (key == 'port' && 'host' in location == false)) && key in location == false)
            location[key] = loc[key];

        var responseCode;
        for (var i = 0; i < args.length; i++)
          if (args[i].match(/^R(\d{3}|)$/))
            responseCode = RegExp.$1 || 307;

        if (args.indexOf('QSA') !== -1 && loc.search && rule.part != 'path' && rule.part != 'href')
        {
          var searchStr = location.search ? loc.search.replace(/^\?/, '&') : loc.search;
          ['href', 'path', 'search'].forEach(function(part){
            location[part] += searchStr;
          });
        }

        if (loc.host == location.host && !responseCode)
        {
          // internal url changes
          logMsg('rewrite', loc.href + ' -> ' + location.href);
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

            // proxy request
            proxy.target.host = location.hostname;
            proxy.target.port = location.port || 80;
            req.url = location.path;

            logMsg('rewrite', 'proxy request:\n \u250C- ' + loc.href + '\n \u2514\u2192 ' + location.href);
            proxy.proxyRequest(req, res);
          }
          else
          {
            if (!responseCode)
              responseCode = 307;

            if (responseCode == 301 || responseCode == 302 || responseCode == 303 || responseCode == 307 || responseCode == 308)
            {
              logMsg('rewrite', loc.href + ' redirect to ' + location.href + ' ' + responseCode);
              res.writeHead(responseCode, {
                Location: location.href
              });
              res.end();
            }
            else
            {
              logMsg('rewrite', loc.href + ' ' + responseCode);
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
  // Path resolving
  //
  var resCacheFile = {};
  var virtualPath = {
    '/basisjs-tools/resourceCache.js': function(req, res){
      var cache = hotStartCache.get();
      if (!contentIsNotModified(req, res, cache.mtime))
      {
        if (resCacheFile.cache !== cache)
        {
          logMsg('client', '/basisjs-tools/resourceCache.js' + ' ' + chalk.yellow('(generate)'));
          resCacheFile.cache = cache;
          resCacheFile.content = 'window.__resources__ = ' + cache.data;
          resCacheFile.zip = {};
        }
        else
        {
          logMsg('client', '/basisjs-tools/resourceCache.js' + ' ' + chalk.green('(from cache)'));
        }

        responseToClient(res, resCacheFile.content, {
          contentType: 'application/javascript',
          mtime: cache.mtime,
          file: resCacheFile,
          encoding: resolveEncoding(req),
          nocache: true/*,
          expires: 1 // 1 min*/
        });
      }
      else
        logMsg('client', '/basisjs-tools/resourceCache.js' + ' ' + chalk.green('304'));
    }
  };

  function checkFilenameCaseSensetive(filename, onerror, onsuccess){
    if (process.platform != 'win32')
      return onsuccess();
    
    child_process.exec('for %I in ("' + filename + '") do @echo %~fI', function(error, stdout, stderr){
      if (error)
      {
        console.warn('Case sensetive check for file existance error:', error);
        return onerror(error);
      }

      var rfilename = path.resolve(String(stdout).trim());
      filename = path.resolve(filename);

      if (rfilename != filename)
        onerror();
      else
        onsuccess();
    });
  }

  function checkFileExists(filename, onerror, onsuccess){
    if (fs.existsSync(filename))
    {
      if (fsIsCaseSensetive)
        checkFilenameCaseSensetive(filename, onerror, onsuccess);
      else
        onsuccess();
    }
    else
      onerror();
  }

  function resolvePathnameFile(req, res, filename, location, callback){
    var fnKey = normPath(filename);

    if (virtualPath.hasOwnProperty(fnKey))
      return virtualPath[fnKey](req, res);

    if (fnKey == '/favicon.ico' && !fs.existsSync(filename))
      return callback(__dirname + '/assets/favicon.ico');

    if (fnKey == '/basisjs-tools/fileSync.js')
      return callback({
        internal: true,
        filename: __dirname + '/assets/client.js'
      });

    checkFileExists(filename, function(){
      logMsg('client', location.pathname + ' ' + chalk.bgRed.white('404'));
        
      res.writeHead(404);
      res.end('File ' + filename + ' not found');
    }, function(){
      var fileStat = fs.statSync(filename);
      if (fileStat.isDirectory())
      {
        if (!/\/$/.test(location.pathname))
        {
          logMsg('client', location.pathname + ' redirect to ' + location.pathname + '/');

          res.writeHead(301, {
            Location: location.pathname + '/'
          });
          res.end();

          return false;
        }

        if (fs.existsSync(filename + '/index.html'))
          return callback(filename + '/index.html');

        if (fs.existsSync(filename + '/index.htm'))
          return callback(filename + '/index.htm');

        logMsg('client', location.pathname + ' ' + chalk.bgRed.white('404'));
        res.writeHead(404);
        res.end('Path ' + filename + ' is not a file');

        return false;
      }

      return callback({
        filename: filename
      });
    });
  }

  function contentIsNotModified(req, res, date){
    if (req.headers['if-modified-since'])
    {
      var headerDate = parseInt(new Date(req.headers['if-modified-since']) / 1000);
      var contentDate = parseInt(date / 1000);

      if (isNaN(headerDate))
      {
        logWarn('Invalid date in If-Modified-Since header');
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

    if (options.nocache)
    {
      headers['Cache-Control'] = 'no-cache';
      headers['Pragma'] = 'no-cache';
    }
    else
    {
      if (options.expires)
      {
        headers['Cache-Control'] = 'max-age=' + options.expires;
        headers['Expires'] = (new Date(+(new Date) + (1000 * options.expires))).toGMTString();
      }
    }

    if (content.length > 512 && options.encoding)  
    {
      headers['Content-Encoding'] = options.encoding;

      if (options.file && options.file.zip && options.encoding in options.file.zip)
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
            /* FIXME: check for content-type is a hack */
            if (!/text\/html/.test(options.contentType) && options.file && options.file.zip)
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
    var extname = path.extname(filename);
      
    return function(err, data){
      if (err)
      {
        res.writeHead(500);
        res.end('Can\'t read file ' + err);
        return;
      }

      // cache file
      var file = getFileInfo(filename);

      // no errors
      var responseOptions = {
        contentType: contentType + (textFile ? '; charset=utf-8' : ''),
        encoding: textFile && resolveEncoding(req), // gzip, deflate
        mtime: fileStat.mtime,
        file: file,
        nocache: true
        //expires: contentType == 'text/html' ? 0 : 60 * 60 // 1 hour
      };

      if (options.hotStartCacheByExt)
      {
        if (options.cache &&
            options.resCache &&
            !fres.internal &&
            hotStartExtensions.indexOf(extname) != -1 &&
            ignorePathes.indexOf(path.normalize(filename)) == -1)
        {
          if (fsWatcher)
            fsWatcher.startWatch(filename);

          hotStartCache.add(fnKey, String(data));
        }
      }
      else
      {
        if (options.cache &&
            options.resCache &&
            ignorePathes.indexOf(path.normalize(filename)) == -1 && // those file will never update
            req.headers['x-basis-resource'])
        {
          if (fsWatcher)
            fsWatcher.startWatch(filename);

          hotStartCache.add(fnKey, String(data));
        }
      }

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
            children: [],
            attribs: {
              href: '//' + req.headers.host + path.dirname(path.normalize(fnKey)) + '/'
            }
          }, true);

        if (options.resCache)
        {
          var resourceScript = {
            type: 'tag',
            name: 'script',
            children: [],
            attribs: {
              src: '/basisjs-tools/resourceCache.js'
            }
          };

          if (firstHeadScript)
            html_ast_tools.insertBefore(firstHeadScript, resourceScript);
          else
            html_ast_tools.injectToHead(ast, resourceScript);
        }

        if (options.sync)
        {
          html_ast_tools.injectToBody(ast, {
            type: 'tag',
            name: 'script',
            children: [],
            attribs: {
              src: '/basisjs-tools/fileSync.js'
            }
          });
        }

        responseToClient(res, html_ast_tools.translate(ast), responseOptions);
      }
      else
      {
        responseToClient(res, data, responseOptions);
      }
    }
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

    resolvePathnameFile(req, res, path.normalize(options.base + location.pathname), location, function(fres){
      if (typeof fres == 'string')
        fres = {
          filename: fres
        };

      var filename = path.normalize(fres.filename);
      var fileStat = fs.statSync(filename);
      var fnKey = normPath(fres.filename);
      var pathname = location.pathname + (fnKey != location.pathname ? ' -> ' + fnKey : '');

      fres.rewritten = reqLocation.href != location.href;

      if (options.readCache)
      {
        if (contentIsNotModified(req, res, fileStat.mtime))
        {
          logMsg('client', pathname + ' ' + chalk.green('304'));
          return;
        }

        if (fileMap[fnKey] && fileMap[fnKey].content != null)
        {
          logMsg('client', pathname + ' ' + chalk.green('(from cache)'));
          getFileHandler(fres, fnKey, req, res, fileStat, location.query)(null, fileMap[fnKey].content);
          return;
        }
      }

      logMsg('client', pathname + ' ' + chalk.yellow('(file read)'));
      files.readFile(filename, getFileHandler(fres, fnKey, req, res, fileStat, location.query));
    });
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
  //console.log('Start server');

  httpServer.listen(options.port, function(){
    var port = this.address().port;

    if (options.verbose)
    {
      if (options.sync)
        console.log('Watching changes for path: ' + chalk.green(options.base));
      else
        console.log('Watching for FS: ' + chalk.green('NO'));

      console.log('Ignore filenames starting with dot: ' + chalk.green(options.dotFilenameIgnore ? 'YES' : 'NO'));
      if (ignorePathes && ignorePathes.length)
        console.log('Ignore pathes:\n  ' + chalk.green(ignorePathes.map(normPath).join('\n  ')) + '\n');

      if (rewriteRules)
        console.log('Rewrite rules:\n  ' + rewriteRules.map(function(rule){ return rule.msg }).join('\n  ') + '\n');
    }

    if (options.index)
    {
      console.log('Build index');
      buildIndex();
      console.log('  DONE');
    }

    console.log('Server run at ' + chalk.green('http://localhost:' + port) + '\n');
  });

  //
  // Messaging
  //

  if (!options.sync)
    return;

  var io = socket_io.listen(httpServer, {
    log: false
  });

  io.sockets.on('connection', function(socket){
    socketClientCount++;
    logMsg('socket', 'client ' + chalk.yellow('connected'));

    socket.on('disconnect', function(){
      socketClientCount--;
      logMsg('socket', 'client ' + chalk.yellow('disconnected'));
    });

    socket.on('saveFile', function(filename, content, autocreate, callback){
      logMsg('socket',
        'request ' + chalk.yellow('saveFile') + ' ' + (autocreate ? '(autocreate)' : '') + filename +
        (options.verbose ? '\n' + content :  ' (' + content.length + ' bytes)')
      );

      var fname = path.normalize(options.base + '/' + filename);

      if (typeof callback != 'function')
        callback = function(){};

      if (!fsWatcher.isFileObserve(fname))
      {
        logMsg('fs', 'try to write file ' + fname);
        if (autocreate)
        {
          var dir = path.dirname(fname);

          if (!fs.existsSync(dir))
          {
            logMsg('fs', 'make dir ' + dir, true);
            fs.mkdir(dir, function(err){
              if (err)
              {
                logWarn('fs', 'save file error: ' + err);
                callback('Save file fault: ' + err);
              }
              else
                fs.writeFile(fname, content, function(err){
                  callback(err);
                });
            });
          }
        } 
        else
          callback('file is not observing');
      }
      else
      {
        logMsg('fs', 'write file ' + fname);
        fs.writeFile(fname, content, function(err){
          callback(err);
        });
      }
    });

    socket.on('createFile', function(filename, content, callback){
      logMsg('socket',
        'request ' + chalk.yellow('createFile') + ' ' + filename +
        (options.verbose ? '\n' + content : ' (' + content.length + ' bytes)')
      );

      if (typeof callback != 'function')
        callback = function(){};

      var fname = options.base + '/' + filename;
       
      if (fs.existsSync(fname) || !fs.existsSync(path.dirname(fname)))
        callback('bad filename');
      else
        fs.writeFile(fname, '', function(err){
          callback(err);
        });
    });

    socket.on('readFile', function(filename, callback){
      logMsg('socket', 'request ' + chalk.yellow('readFile') + ' ' + filename);

      files.readFile(path.normalize(options.base + '/' + filename), function(err, data, filename){
        if (err)
          callback(err);
        else
          callback(null, {
            filename: normPath(filename),
            content: data
          });
      });
    });

    socket.on('openFile', function(filename, callback){
      logMsg('socket', 'request ' + chalk.yellow('openFile') + ' ' + filename);

      if (typeof callback != 'function')
        callback = function(){};

      if (options.editor)
      {
        var cmd = options.editor + ' ' + path.resolve(options.base, filename.replace(/^\//, ''));

        logMsg('cmd', cmd, true);
        child_process.exec(cmd, function(err){
          if (err)
          {
            callback('Run command: ' + err);
            console.error('[CLI] openFile: ' + err);
          }
          else
            callback();
        });
      }
      else
        callback('Editor command is no specified');
    });

    function resolveFilename(filename){
      if (!fs.existsSync(filename))
        return false;

      if (fs.statSync(filename).isDirectory())
      {
        if (fs.existsSync(filename + path.sep + 'index.html'))
          return path.normalize(filename + path.sep + 'index.html');

        if (fs.existsSync(filename + path.sep + 'index.htm'))
          return path.normalize(filename + path.sep + 'index.htm');

        return false;
      }

      return filename;
    }

    socket.on('getFileGraph', function(filename, callback){
      logMsg('socket', 'request ' + chalk.yellow('getFileGraph') + ' ' + filename);

      if (typeof callback == 'function')
      {
        var fn = resolveFilename(path.normalize(options.base + url.parse(filename, false, true).pathname));
        var startTime = new Date;
        var args = [
          '--file', fn,
          '--base', options.base,
          '--js-cut-dev',
          '--css-info',
          '--l10n-info'
        ];

        if (!fn)
          callback('File ' + filename + ' not found');

        logMsg('fork', 'basis extract ' + args.join(' '), true);
        var cp = child_process.fork(
            __dirname + '/../extractor',
            args,
            { silent: true }
          )
          .on('exit', function(code){
            if (code)
            {
              logWarn('socket', 'getFileGraph: exit ' + code);
              callback('Process exit with code ' + code);
            }
          })
          .on('message', function(res){
            if (res.error)
            {
              logMsg('socket', 'send error on getFileGraph: ' + res.error);
              callback('Error on file map fetch: ' + res.error);
            }
            else
            {
              logMsg('socket', 'send file graph (extrating done in ' + (new Date - startTime) + 'ms)', true);
              callback(null, res.data);
            }
          });
      }
    });

    socket.on('ready', function(clientFiles){
      logMsg('socket',
        'request ' + chalk.yellow('ready') + ' (client ' + (clientFiles ? clientFiles.length : 0) + ' files)', true);

      if (Array.isArray(clientFiles))
        clientFiles.forEach(function(filename){
          fsWatcher.startWatch(path.normalize(options.base + '/' + filename));
        });

      var serverFiles = Object.keys(fileMap);
      logMsg('socket', 'knownFiles (server ' + serverFiles.length + ' files)', true);
      socket.emit('knownFiles', serverFiles);
    });
  });

  var createCallback = function(fileInfo){
    if (!socketClientCount)
      return;

    logMsg('broadcast', chalk.green('newFile') + ' ' + fileInfo.filename);
    io.sockets.emit('newFile', fileInfo);
  };

  var updateCallback = function(fileInfo){
    if (!socketClientCount)
      return;

    logMsg('broadcast', chalk.green('updateFile') + ' ' + fileInfo.filename);
    io.sockets.emit('updateFile', fileInfo);
  };

  var deleteCallback = function(filename){
    if (!socketClientCount)
      return;

    logMsg('broadcast', chalk.green('deleteFile') + ' ' + filename);
    io.sockets.emit('deleteFile', normPath(filename));
  };

  files.addReadCallback(function(err, data, filename){
    if (!err)
    {
      var file = getFileInfo(filename);
      if (hotStartCache.has(file.filename))
        updateCallback(file);
    }
  });


  //
  // File System Watcher
  //

  var fsWatcher = (function(){
    var watchFolders = {};

    function onWatchEvent(filename, dirInfo){
      logMsg('fs', 'watch event for ' + path.relative(options.base, filename), true);

      var fnKey = normPath(filename);
      var fileInfo = fileMap[fnKey];

      if (!fileInfo || !fs.existsSync(filename))
      {
        dirInfo.remove(filename);
        delete fileMap[fnKey];
        return;
      }

      var stats = fs.statSync(filename);
      if (stats.mtime > (fileInfo.mtime || 0))
      {
        logMsg('fs', 'update file ' + fnKey, true);
        fileInfo.mtime = stats.mtime;
        files.readFile(filename, function(err, data, filename){
          if (err)
            return;

          if (!hotStartCache.has(fnKey))
            updateCallback(fileInfo);
        });
      }
    }

    function getWatcher(dirInfo){
      if (!fs.existsSync(dirInfo.path))
        return;

      logMsg('fs', chalk.red('start watch dir ') + (path.relative(options.base, dirInfo.path).replace(/\\/g, '/') || '/'), true);

      return fs.watch(dirInfo.path)
        .on('change', function(event, filename){
          //console.log(event, filename, Object.keys(dirInfo.files));
          if (filename)
          {
            filename = dirInfo.path + '/' + filename;
            if (normPath(filename) in dirInfo.files)
              onWatchEvent(filename, dirInfo);
          }
        })
        .on('error', function(error){
          logWarn('fs', 'watch error (' + path + '):' + error);
          if (!fs.existsSync(dirInfo.path))
          {
            logMsg('fs', 'stop watch ' + dirInfo.path);

            for (var fn in dirInfo.files)
              dirInfo.remove(dirInfo.files[fn]);

            delete watchFolders[dirInfo.path];
          }
        });
    }

    function getWatchDir(path){
      var dirInfo = watchFolders[path];

      if (dirInfo)
      {
        if (dirInfo.count && !dirInfo.watcher)
          dirInfo.watcher = getWatcher(dirInfo);
      }
      else
      {
        dirInfo = watchFolders[path] = {
          path: path || '.',
          watcher: null,
          count: 0,
          files: {},
          add: function(filename){
            var fnKey = normPath(filename);
            if (fnKey in this.files == false)
            {
              logMsg('fs', 'start watch ' + fnKey, true);

              getFileInfo(filename); // reg file in global map
              this.count++;
              this.files[fnKey] = filename;

              if (!this.watcher)
                this.watcher = getWatcher(this);

              if (process.platform != 'win32')
              {
                logMsg('fs', 'add file watcher ' + fnKey, true);
                fs.watchFile(filename, { interval: 200 }, function(curr, prev){
                  onWatchEvent(filename, dirInfo);
                });
              }
            }
          },
          remove: function(filename){
            var fnKey = normPath(filename);
            if (fnKey in this.files)
            {
              logMsg('fs', 'stop watch ' + fnKey, true);

              this.count--;
              delete this.files[fnKey];

              if (this.count == 0 && this.watcher)
              {
                this.watcher.close();
                this.watcher = null;
              }

              fs.unwatchFile(filename);
            }
          },
          has: function(filename){
            return normPath(filename) in this.files;
          }
        };
      }

      return dirInfo;
    }

    return {
      startWatch: function(filename){
        if (options.sync)
          getWatchDir(path.dirname(filename)).add(filename);
      },
      stopWatch: function(filename){
        if (options.sync)
          getWatchDir(path.dirname(filename)).remove(filename);
      },
      isFileObserve: function(filename){
        return options.sync && getWatchDir(path.dirname(filename)).has(filename);
      }
    }
  })();
}
