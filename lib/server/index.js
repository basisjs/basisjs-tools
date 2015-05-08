var fs = require('fs');
var url = require('url');
var path = require('path');
var http = require('http');
var socket_io = require('socket.io');
var mime = require('mime');
var zlib = require('zlib');
var child_process = require('child_process');
var utils = require('./modules/utils');
var chalk = require('chalk');

var htmlTools = require('../ast/html');
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
  chalk.enabled = options.color && process.stdout.isTTY;

  // imports
  var logMsg = utils.logMsg;
  var logWarn = utils.logWarn;
  var normPath = utils.relPathBuilder(options.base);
  var hotStartCache = require('./modules/resourceCache');

  // settings
  var hotStartExtensions = ['.css', '.tmpl', '.json', '.js', '.l10n'];
  var ignorePathes = options.ignore;
  var rewriteRules = [];
  var rewriteRequest = function(location, req, res){
    return location;
  };
  var contentHandlers;

  // check base path
  if (!fs.existsSync(options.base))
  {
    console.warn('Base path `' + options.base + '` not found');
    process.exit();
  }

  if (options.rewrite)
  {
    // avoid UNABLE_TO_VERIFY_LEAF_SIGNATURE error with invalid SSL certificates on the server
    // http://stackoverflow.com/questions/20082893/unable-to-verify-leaf-signature
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

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
        part: part,
        proxy: null
      });
    }

    rewriteRequest = require('./modules/proxy').create(rewriteRules);
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

  if (Object.keys(options.preprocess).length)
  {
    console.log('Preprocessors:');
    for (var key in options.preprocess)
    {
      options.preprocess[key].forEach(function(preprocessorPath){
        try {
          var preprocessor = require(preprocessorPath);

          if (typeof preprocessor == 'function')
          {
            files.addPreprocessor(key, preprocessor);
            console.log('  ' + chalk.green(key) + ' ' + preprocessorPath);
          }
          else
          {
            logWarn('preprocess', 'Preprocessor `' + preprocessorPath + '` is not a function.');
            process.exit();
          }
        } catch(e) {
          logWarn('preprocess', 'Error on preprocessor `' + preprocessorPath + '` load: ' + e);
          process.exit();
        }
      });
    }
    console.log();
  }


  //
  // files
  //

  var fileMap = {};

  function getFileInfo(filename){
    var fnKey = normPath(filename);
    var file = fileMap[fnKey];

    if (!file)
    {
      logMsg('info', fnKey + ' ' + chalk.green('(add)'), true);
      file = fileMap[fnKey] = {
        filename: fnKey,
        content: null
      };
    }

    return file;
  }

  function dropFileInfo(filename){
    var fnKey = normPath(filename);
    var file = fileMap[fnKey];

    if (file)
    {
      logMsg('info', fnKey + ' ' + chalk.red('(drop)'), true);
      delete fileMap[fnKey];

      hotStartCache.remove(fnKey);

      if (fsWatcher)
        fsWatcher.stopWatch(filename);
    }
  }

  files.addReadCallback(function(err, data, filename){
    if (err)
      return logMsg('fs', 'Error: Can\'t read file ' + filename + ': ' + err);

    var file = getFileInfo(filename);
    if (file.content != data)
    {
      logMsg('info', file.filename + ' ' + chalk.yellow('(update content: ' + data.length + 'bytes)'), true);
      file.mtime = fs.statSync(filename).mtime || 0;
      file.content = data;
      file.zip = {};

      if (hotStartCache.has(file.filename))
        hotStartCache.add(file.filename, data);

      if (fsWatcher)
        fsWatcher.startWatch(filename);
    }
  });


  //
  // Path resolving
  //
  var resCacheFile = {};
  var virtualPath = {
    '/basisjs-tools/resourceCache.js': function(req, res, fnKey){
      var cache = hotStartCache.get();
      if (!contentIsNotModified(req, res, cache.mtime))
      {
        if (resCacheFile.cache !== cache)
        {
          logMsg('client', fnKey + ' ' + chalk.yellow('(generate)'));
          resCacheFile.cache = cache;
          resCacheFile.content = 'window.__resources__ = ' + cache.data;
          resCacheFile.zip = {};
        }
        else
        {
          logMsg('client', fnKey + ' ' + chalk.green('(from cache)'));
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
        logMsg('client', fnKey + ' ' + chalk.green('304'));
    },
    '/basisjs-tools/fileSync.js': function(req, res, fnKey){
      var socketIOClientfilename = __dirname + '/../../node_modules/socket.io/node_modules/socket.io-client/socket.io.js';
      var filename = __dirname + '/assets/client.js';
      var mtime = new Date(Math.max(
        fs.statSync(socketIOClientfilename).mtime,
        fs.statSync(filename).mtime
      ));

      if (!contentIsNotModified(req, res, mtime))
      {
        var errHandler = function(err, filename){
          logMsg('client', fnKey + ' ' + chalk.red('500'));
          res.writeHead(500);
          res.end('Can\'t read file (' + filename + '): ' + err);
        };

        files.readFile(filename, function(err, fileSyncData, fn){
          if (err)
            return errHandler(err, fn);

          files.readFile(socketIOClientfilename, function(err, data, fn){
            if (err)
              return errHandler(err, fn);

            logMsg('client', fnKey + ' ' + chalk.yellow('(read)'));

            // fix issue with require.js using
            // TODO: remove when bug will be fixed in socket.io-client
            data = data.replace(/\{/, '{var define;');

            responseToClient(res, data + fileSyncData, {
              contentType: 'application/javascript',
              mtime: mtime
            });
          });
        });
      }
      else
        logMsg('client', fnKey + ' ' + chalk.green('304'));
    }
  };

  function checkFilenameCaseSensetive(filename, onerror, onsuccess){
    var parts = path.relative(process.cwd(), filename).split(path.sep).filter(Boolean);
    var checkPath = '.';
    var part;

    while (part = parts.shift())
    {
      if (part != '..' && fs.readdirSync(checkPath).indexOf(part) == -1)
        return onerror('wrong case for `' + part + '` at `' + checkPath.replace(/^\./, '') + '`');

      checkPath += '/' + part;
    }

    onsuccess();
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
      return virtualPath[fnKey](req, res, fnKey);

    if (fnKey == '/favicon.ico' && !fs.existsSync(filename))
      return callback(__dirname + '/assets/favicon.ico');

    checkFileExists(filename, function(error){
      logMsg('client',
        location.pathname + ' ' + chalk.bgRed.white('404') +
        (error && !options.verbose ? ' ' + chalk.gray(error) : '')
      );

      if (options.verbose)
      {
        logMsg('', 'full path: ' + filename);
        logMsg('', 'reason: ' + chalk.gray(error || 'file not found'));
      }

      res.writeHead(404);
      res.end('File ' + filename + ' not found');
    }, function(){
      var fileStat = fs.statSync(filename);
      if (fileStat.isDirectory())
      {
        if (!/\/$/.test(location.pathname))
        {
          logMsg('client', location.pathname + ' redirect to ' + location.pathname + '/ ' + chalk.green('301'));

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

      if (headerDate >= (contentDate || 0))
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
        headers['Expires'] = (new Date(Number(new Date) + 1000 * options.expires)).toGMTString();
      }
    }

    if (content.length > 1024 && options.encoding)
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



  function getFileHandler(fres, fnKey, req, res, fileStat, location){
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
          data = handler(contentType, data, fnKey, fres, location) || data;

      if (contentType == 'text/html')
      {
        var ast = htmlTools.parse(String(data));
        var head;
        var body;
        var firstScript;
        var firstHeadScript;

        if (fres.rewritten || options.resCache || options.sync)
        {
          htmlTools.walk(ast, {
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
          htmlTools.injectToHead(ast, {
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
              src: '/basisjs-tools/resourceCache.js'
            },
            children: []
          };

          if (firstHeadScript)
            htmlTools.insertBefore(firstHeadScript, resourceScript);
          else
            htmlTools.injectToHead(ast, resourceScript);
        }

        if (options.sync)
        {
          htmlTools.injectToBody(ast, {
            type: 'tag',
            name: 'script',
            attribs: {
              src: '/basisjs-tools/fileSync.js',
              async: undefined,
              defer: undefined
            },
            children: []
          });

          if (options.inspect)
            htmlTools.injectToBody(ast, {
              type: 'tag',
              name: 'script',
              attribs: {
                src: options.inspect,
                async: undefined,
                defer: undefined
              },
              children: []
            });
        }

        responseToClient(res, htmlTools.translate(ast), responseOptions);
      }
      else
      {
        responseToClient(res, data, responseOptions);
      }
    };
  }


  //
  // Server
  //
  var httpServer = http.createServer(function(req, res){
    var reqLocation = url.parse('//' + req.headers.host + req.url, true, true);
    var location = rewriteRequest(reqLocation, req, res);

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

        if (fileMap[fnKey] && (fsWatcher && fsWatcher.isFileObserve(filename)) && fileMap[fnKey].content != null)
        {
          logMsg('client', pathname + ' ' + chalk.green('(from cache)'));
          getFileHandler(fres, fnKey, req, res, fileStat, location)(null, fileMap[fnKey].content);
          return;
        }
      }

      logMsg('client', pathname + ' ' + chalk.yellow('(file read)'));
      files.readFile(filename, getFileHandler(fres, fnKey, req, res, fileStat, location));
    });
  }).on('error', function(er){
    if (er.code == 'EADDRINUSE')
      console.log(chalk.bgRed.white('FATAL') + ' Port ' + chalk.green(options.port) + ' already in use.');
    else
      logWarn('server', er);
  });


  function buildIndex(){
    function readdir(dirname){
      if (ignorePathes.indexOf(path.normalize(dirname)) != -1 &&
          (!options.dotFilenameIgnore || path.basename(filename).charAt(0) != '.'))
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
      console.log('Base path: ' + chalk.green(options.base));

      if (options.editor)
        console.log('Command for file editing: ' + chalk.green(options.editor + ' [filename]'));

      console.log('Watching for FS: ' + chalk.green(options.sync ? 'YES' : 'NO'));

      if (ignorePathes && ignorePathes.length)
        console.log('Ignore paths:\n  ' + chalk.green(ignorePathes.map(normPath).join('\n  ')) + '\n');

      if (rewriteRules)
        console.log('Rewrite rules:\n  ' + rewriteRules.map(function(rule){
          return rule.msg;
        }).join('\n  ') + '\n');
    }

    if (options.index)
    {
      console.log('Build index');
      console.log('  Ignore filenames starting with dot: ' + chalk.green(options.dotFilenameIgnore ? 'YES' : 'NO'));
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

  var syncServer = (function(){
    var syncServer = socket_io(httpServer, { serveClient: false });
    var clientCount = 0;

    syncServer.sockets.on('connection', function(socket){
      logMsg('socket', 'client ' + chalk.yellow('connected'));
      clientCount++;

      socket.on('disconnect', function(){
        clientCount--;
        logMsg('socket', 'client ' + chalk.yellow('disconnected'));
      });

      socket.on('handshake', function(clientData){
        var clientFiles = clientData.files;

        logMsg('socket',
          'request ' + chalk.yellow('handshake') + ' (client ' + (clientFiles ? clientFiles.length : 0) + ' files)', true);

        if (Array.isArray(clientFiles))
          clientFiles.sort().forEach(function(filename){
            var fnKey = path.normalize(options.base + '/' + filename);
            fsWatcher.startWatch(fnKey);
            files.readFile(fnKey, function(err, content){
              if (!err)
                hotStartCache.add(filename, content);
            });
          });

        var serverFiles = Object.keys(fileMap).filter(function(fn){
          return hotStartCache.has(fn);
        });
        logMsg('socket', 'response ' + chalk.yellow('handshake') + ' (server ' + serverFiles.length + ' files)', true);

        socket.emit('handshake', {
          files: serverFiles
        });
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
          (options.verbose ? '\n' + content : ' (' + (content || '').length + ' bytes)')
        );

        if (typeof callback != 'function')
          callback = function(){};

        var fname = options.base + '/' + filename;

        if (fs.existsSync(fname) || !fs.existsSync(path.dirname(fname)))
          callback('bad filename');
        else
          fs.writeFile(fname, '', function(err){
            callback(err);
            syncServer.emit('newFile', { filename: filename, content: '' });
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
              callback('Run command error: ' + err);
              logWarn('cli', 'openFile: ' + String(err).replace(/[\r\n]+$/, ''));
            }
            else
              callback();
          });
        }
        else
        {
          logWarn('cli', 'Editor command is no specified, request ignored');
          callback('Editor command is no specified, request ignored');
        }
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
            '--js-info',
            '--css-info',
            '--l10n-info'
          ];

          if (!fn)
            callback('File ' + filename + ' not found');

          logMsg('fork', 'basis extract ' + args.join(' '), true);
          var cp = child_process.fork(
              __dirname + '/../extract',
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
    });

    // var createCallback = function(fileInfo){
    //   if (!clientCount)
    //     return;

    //   logMsg('bcast', chalk.green('newFile') + ' ' + fileInfo.filename);
    //   syncServer.emit('newFile', fileInfo);
    // };

    // var deleteCallback = function(filename){
    //   if (!clientCount)
    //     return;

    //   logMsg('bcast', chalk.green('deleteFile') + ' ' + filename);
    //   syncServer.emit('deleteFile', normPath(filename));
    // };

    var updateCallback = function(fileInfo){
      if (!clientCount || /^basisjs-tools:/.test(fileInfo.filename))
        return;

      logMsg('bcast', chalk.green('updateFile') + ' ' + fileInfo.filename);
      syncServer.emit('updateFile', fileInfo);
    };

    files.addReadCallback(function(err, data, filename){
      if (!err)
      {
        var file = getFileInfo(filename);
        if (hotStartCache.has(file.filename))
          updateCallback(file);
      }
    });

    return {
      updateCallback: updateCallback
    };
  })();


  //
  // File System Watcher
  //

  var fsWatcher = (function(){
    var watchFolders = {};
    var queue = {};
    var queueTimer;

    function updateFile(fnKey){
      var fileInfo = fileMap[fnKey];
      var filename = queue[fnKey];

      if (!fs.existsSync(filename))
        return dropFileInfo(filename);

      logMsg('watcher', fnKey + ' ' + chalk.yellow('(update file)'), true);
      files.readFile(filename, function(err, data, filename){
        if (err)
          return;

        if (!hotStartCache.has(fnKey))
          syncServer.updateCallback(fileInfo);
      });
    }

    function runQueue(){
      queueTimer = clearTimeout(queueTimer);

      // re-read files
      for (var fnKey in queue)
        updateFile(fnKey);

      // reset queue
      queue = {};
    }

    function onWatchEvent(filename, dirInfo){
      logMsg('watcher', normPath(path.relative(options.base, filename)) + ' ' + chalk.magenta('(event)'), true);

      var fnKey = normPath(filename);
      var fileInfo = fileMap[fnKey];

      if (!fileInfo || !fs.existsSync(filename))
      {
        dropFileInfo(filename);
        return;
      }

      var stats = fs.statSync(filename);
      if (stats.mtime > (fileInfo.mtime || 0))
      {
        fileInfo.mtime = stats.mtime;
        queue[fnKey] = filename;
        if (!queueTimer)
          queueTimer = setTimeout(runQueue, 100);
      }
    }

    function getWatcher(dirInfo){
      if (!fs.existsSync(dirInfo.path))
        return;

      logMsg('watcher', normPath(dirInfo.path) + ' ' + chalk.green('(start watch dir)'), true);

      return fs.watch(dirInfo.path)
        .on('change', function(event, filename){
          //console.log(event, filename, Object.keys(dirInfo.files));
          if (filename)
          {
            // file updated
            filename = dirInfo.path + '/' + filename;
            if (normPath(filename) in dirInfo.files)
              onWatchEvent(filename, dirInfo);
          }
          else
          {
            // file deleted
            for (var fn in dirInfo.files)
              if (!fs.existsSync(dirInfo.files[fn]))
                dropFileInfo(dirInfo.files[fn]);
          }
        })
        .on('error', function(error){
          logWarn('watcher', 'error (' + dirInfo.path + '):' + error);
          if (!fs.existsSync(dirInfo.path))
          {
            logMsg('watcher', dirInfo.path + ' ' + chalk.red('(stop watch dir)'));

            for (var fn in dirInfo.files)
              dropFileInfo(dirInfo.files[fn]);

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
              if (!this.watcher)
                this.watcher = getWatcher(this);

              logMsg('watcher', fnKey + ' ' + chalk.green('(start watch)'), true);

              getFileInfo(filename); // reg file in global map
              this.count++;
              this.files[fnKey] = filename;

              if (process.platform != 'win32')
              {
                logMsg('watcher', fnKey + ' ' + chalk.yellow('(add file watcher)'), true);
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
              logMsg('watcher', fnKey + ' ' + chalk.red('(stop watch)'), true);

              this.count--;
              delete this.files[fnKey];

              if (this.count == 0 && this.watcher)
              {
                logMsg('watcher', normPath(dirInfo.path) + ' ' + chalk.red('(stop watch dir)'), true);
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
    };
  })();
}
