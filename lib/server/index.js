var fs = require('fs');
var url = require('url');
var path = require('path');
var http = require('http');
var socket_io = require('socket.io');
var mime = require('mime');
var zlib = require('zlib');
var child_process = require('child_process');
var chalk = require('chalk');
var exit = require('exit');
var resolve = require('resolve');

var html = require('basisjs-tools-ast').html;
var utils = require('./modules/utils');
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
  var ignorePaths = options.ignore;
  var rewriteRequest = function(location, req, res){
    return location;
  };

  // check base path
  if (!fs.existsSync(options.base))
  {
    console.error('Base path `' + options.base + '` not found');
    exit(2);
  }

  if (options.rewrite)
    rewriteRequest = require('./modules/rewrite').create(options.rewrite);

  // init plugins
  options.plugins.forEach(function(pluginCfg, index, array){
    try {
      var pluginFilename = resolve.sync(pluginCfg.name, { basedir: process.cwd() });
      var plugin = require(pluginFilename);

      pluginCfg.filename_ = pluginFilename;

      if (typeof plugin.server == 'function')
      {
        try {
          plugin.server(require('./modules/plugin-api')(options, pluginCfg));
          console.log('Plugin ' + chalk.yellow(pluginCfg.name) + ' loaded');
          if (index == array.length - 1)
            console.log();
        } catch(e) {
          logWarn('plugin', 'Error on plugin `' + pluginCfg.name + '` init: ' + e);
          exit(2);
        }
      }
    } catch(e) {
      logWarn('plugin', 'Error on plugin `' + pluginCfg.name + '` load: ' + e);
      exit(2);
    }
  });


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


      if (
          options.resCache &&
          req.headers['x-basis-resource'] &&
          ignorePaths.indexOf(path.normalize(filename)) == -1 // those file will never update
         )
      {
        if (fsWatcher)
          fsWatcher.startWatch(filename);

        hotStartCache.add(fnKey, String(data));
      }

      if (contentType == 'text/html')
      {
        var ast = html.parse(String(data));

        if (fres.rewritten)
          html.injectToHead(ast, {
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

          var firstScript = html.getElementByName(ast.head, 'script') || html.getElementByName(ast, 'script');
          if (firstScript)
            html.insertBefore(firstScript, resourceScript);
          else
            html.injectToHead(ast, resourceScript);
        }

        if (options.sync)
        {
          html.injectToBody(ast, {
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
            html.injectToBody(ast, {
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

        responseToClient(res, html.translate(ast), responseOptions);
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
      if (ignorePaths.indexOf(path.normalize(dirname)) != -1 &&
          path.basename(filename).charAt(0) != '.')
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

    console.log('Build index');
    console.log('  Path: ' + options.index);

    readdir(options.index);

    console.log('  DONE');
  }

  //create server

  httpServer.listen(options.port, function(){
    var port = this.address().port;

    if (options.verbose)
    {
      console.log('Base path: ' + chalk.green(options.base));
      console.log('Watching for FS: ' + chalk.green(options.sync ? 'YES' : 'NO'));

      if (options.editor)
        console.log('Command to open file in editor: ' + chalk.green(options.editor + ' [filename]'));

      if (ignorePaths && ignorePaths.length)
        console.log('Ignore paths:\n  ' + chalk.green(ignorePaths.map(normPath).join('\n  ')) + '\n');

      if (rewriteRequest.rules)
        console.log('Rewrite rules:\n  ' + rewriteRequest.rules.map(function(rule){
          return chalk.green(rule.re.toString()) + ' → ' + chalk.green(rule.url);
        }).join('\n  '));

      if (options.plugins.length)
        console.log('Plugins:\n  ' + options.plugins.map(function(pluginCfg){
          return chalk.green(pluginCfg.name) + ' → ' + chalk.gray(path.relative(process.cwd(), pluginCfg.filename_));
        }).join('\n  '));

      console.log();
    }

    if (options.index)
      buildIndex();

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
          require('basisjs-tools-build').extract
            .fork(
              args,
              { silent: true }
            )
            .on('exit', function(code){
              if (code)
              {
                logWarn('socket', 'getFileGraph: exit ' + code);
                callback('Process exit with code ' + code);
              }
              else
              {
                logMsg('fork', 'getFileGraph: complete in ' + (new Date - startTime) + 'ms');
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
