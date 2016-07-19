var fs = require('fs');
var url = require('url');
var path = require('path');
var http = require('http');
var mime = require('mime');
var zlib = require('zlib');
var chalk = require('chalk');
var exit = require('exit');
var resolve = require('resolve');
var html = require('basisjs-tools-ast').html;
var utils = require('./modules/utils');
var files = require('./modules/files');
var command = require('./command');


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
  files.setBase(options.base);

  // imports
  var checkFileExists = require('./modules/existsCaseSensetive');
  var virtualPath = require('./modules/virtualPath');
  var logMsg = utils.logMsg;
  var logWarn = utils.logWarn;
  var normPath = files.relativePath;
  var fsWatcher = { // stab fsWatcher
    awaitFile: function(){},
    startWatch: function(){},
    stopWatch: function(){},
    isFileObserve: function(){}
  };

  // settings
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

  require('./modules/openFile').init(options);

  // init plugins
  options.plugins.forEach(function(pluginCfg, index, array){
    try {
      var pluginFilename = resolve.sync(pluginCfg.name, { basedir: process.cwd() });
      var plugin = require(pluginFilename);

      pluginCfg.filename_ = pluginFilename;

      if (typeof plugin.server == 'function')
      {
        try {
          plugin.server(require('./modules/plugin-api')(options, pluginCfg), pluginCfg.options || {});
          console.log('Plugin ' + chalk.yellow(pluginCfg.name) + ' loaded');
        } catch(e) {
          logWarn('plugin', 'Error on plugin `' + pluginCfg.name + '` init: ' + e);
          exit(2);
        }
      }
    } catch(e) {
      logWarn('plugin', 'Error on plugin `' + pluginCfg.name + '` load: ' + e);
      exit(2);
    }

    // blank line after last item list
    if (index == array.length - 1)
      console.log('');
  });

  if (options.verbose)
  {
    console.log('Base path: ' + chalk.green(options.base));
    console.log('Watching for FS: ' + chalk.green(options.sync ? 'YES' : 'NO'));

    if (options.editor)
      console.log('Command to open file in editor: ' + chalk.green(options.editor + ' [filename]'));

    if (ignorePaths && ignorePaths.length)
      console.log('Ignore paths:\n  ' + chalk.green(ignorePaths.map(normPath).join('\n  ')) + '\n');

    if (options.plugins.length)
      console.log('Plugins:\n  ' + options.plugins.map(function(pluginCfg){
        return chalk.green(pluginCfg.name) + ' → ' + chalk.gray(path.relative(process.cwd(), pluginCfg.filename_).replace(/\\/g, '/'));
      }).join('\n  '));

    var rewriteRules = Object.keys(rewriteRequest.rules || {}).sort().map(function(pathMask){
      var rules = rewriteRequest.rules[pathMask];

      if (!rules.length)
        return;

      return '  ' + chalk.cyan(pathMask) + '\n    ' + rules.map(function(rule){
        return chalk.green(rule.re.toString()) + ' → ' + chalk.green(rule.url);
      });
    }).filter(Boolean).join('\n\n');

    if (rewriteRules)
      console.log('Rewrite rules:\n' + rewriteRules);

    console.log();
  }

  if (options.index)
    (function(){
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
              files.addToCache(filename, fs.readFileSync(filename, 'utf8'));
          }
        }
      }

      console.log('Build index');
      console.log('  Path: ' + options.index);

      var hotStartExtensions = ['.css', '.tmpl', '.json', '.js', '.l10n'];
      readdir(options.index);

      console.log('  DONE');
    })();


  //
  // files
  //

  files.onAdd(function(filename){
    var fnKey = normPath(filename);

    logMsg('info', normPath(filename) + ' ' + chalk.green('(add)'), true);
  });
  files.onRemove(function(filename){
    var fnKey = normPath(filename);
    var fileInfo = files.getInfo(filename);

    logMsg('info', fnKey + ' ' + chalk.red('(drop)'), true);

    fsWatcher.stopWatch(filename);
    if (fileInfo.notify)
      fsWatcher.awaitFile(filename);
  });
  files.onRead(function(err, data, filename){
    if (err)
      return logMsg('fs', 'Error: Can\'t read file ' + filename + ': ' + err);

    var file = files.getInfo(filename, true);
    var fnKey = normPath(filename);
    if (file.content != data)
    {
      logMsg('info', fnKey + ' ' + chalk.yellow('(update content: ' + data.length + 'bytes)'), true);
      file.mtime = fs.statSync(filename).mtime || 0;
      file.content = data;
      file.zip = {};

      files.updateCache(filename, data);
      fsWatcher.startWatch(filename);
    }
  });


  //
  // Path resolving
  //

  function resolvePathnameFile(req, res, filename, location, callback){
    var fnKey = normPath(filename);

    if (virtualPath.has(fnKey))
      return virtualPath.get(fnKey)({
        location: location,
        fnKey: fnKey,
        encoding: resolveEncoding(req),
        isContentModified: function(date){
          return isContentModified(req, res, date);
        },
        responseToClient: function(content, headers){
          return responseToClient(res, content, headers || {});
        },
        serverError: function(message){
          logMsg('client', fnKey + ' ' + chalk.red('500'));
          res.writeHead(500);
          res.end(message || 'Error');
        },
        logMsg: function(message){
          return logMsg('client', fnKey + ' ' + message);
        },
        logWarn: function(message){
          return logWarn('client', fnKey + ' ' + message);
        }
      });

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

      if (fsWatcher && req.headers['x-basis-resource'])
        fsWatcher.awaitFile(filename);

      res.writeHead(404);
      res.end('File ' + filename + ' not found');
    }, function(){
      if (fs.statSync(filename).isDirectory())
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

  function isContentModified(req, res, date){
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
        return false;
      }
    }

    return true;
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

    res.writeHead(options.status || 200, headers);
    res.end(content);
  }

  function resolveEncoding(req){
    var encoding = req.headers['accept-encoding'];

    if (encoding)
      return encoding.toLowerCase().replace(/^.*?\b(gzip|deflate)\b.*$|.*/, '$1');

    return '';
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
      var file = files.getInfo(filename, true);

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
        fsWatcher.startWatch(filename);
        files.addToCache(filename, String(data));
      }

      if (contentType == 'text/html')
      {
        var ast = html.parse(String(data), { location: false });

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
        if (!isContentModified(req, res, fileStat.mtime))
        {
          logMsg('client', pathname + ' ' + chalk.green('304'));
          return;
        }

        var fileInfo = files.getInfo(filename);
        if (fileInfo && fsWatcher.isFileObserve(filename) && fileInfo.content != null)
        {
          logMsg('client', pathname + ' ' + chalk.green('(from cache)'));
          getFileHandler(fres, fnKey, req, res, fileStat, location)(null, fileInfo.content);
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

  //create server

  httpServer.listen(options.port, function(){
    var port = this.address().port;

    console.log('Server run at ' + chalk.green('http://localhost:' + port) + '\n');
  });

  //
  // Messaging and fs sync
  //

  if (!options.sync)
    return;

  require('./modules/syncServer')(httpServer, options);
  fsWatcher = require('./modules/watch');
  fsWatcher.setBase(options.base);
}
