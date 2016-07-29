var fs = require('fs');
var path = require('path');
var url = require('url');
var http = require('http');
var mime = require('mime');
var zlib = require('zlib');
var chalk = require('chalk');
var html = require('basisjs-tools-ast').html;
var logMsg = require('./utils').logMsg;
var logWarn = require('./utils').logWarn;
var logError = require('./utils').logError;
var files = require('./files');
var plugin = require('./plugin');
var virtualPath = require('./http/virtualPath');

function isContentModified(req, res, date){
  if (req.headers['if-modified-since'])
  {
    var headerDate = parseInt(new Date(req.headers['if-modified-since']) / 1000);
    var contentDate = parseInt(date / 1000);

    if (isNaN(headerDate))
    {
      logWarn('http', 'Invalid date in If-Modified-Since header');
      headerDate = Infinity; // cheapest way response with no changed
    }

    if (headerDate >= (contentDate || 0))
    {
      logMsg('http', reqTransition(req) + ' ' + chalk.green(304));
      res.writeHead(304, {
        'Last-Modified': date.toGMTString()
      });
      res.end();
      return false;
    }
  }

  return true;
}

function responseToClient(req, res, content, options, postfix){
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
      zlib[options.encoding](content, function(err, gzipped){
        if (err)
        {
          res.writeHead(500);
          res.end('Error while content compression: ' + err);
          return;
        }

        /* FIXME: check for content-type is a hack */
        if (!/text\/html/.test(options.contentType) && options.file && options.file.zip)
          options.file.zip[options.encoding] = gzipped;

        responseToClient(req, res, content, options, postfix);
      });
      return;
    }
  }

  logMsg('http', reqTransition(req) + ' ' + chalk.green(options.status || 200) + (postfix ? ' ' + postfix : ''));
  res.writeHead(options.status || 200, headers);
  res.end(content);
}

function resolveEncoding(req){
  var encoding = req.headers['accept-encoding'];

  if (encoding)
    return encoding.toLowerCase().replace(/^.*?\b(gzip|deflate)\b.*$|.*/, '$1');

  return '';
}

function processHtml(req, filename, data, options){
  var ast = html.parse(String(data), { location: false });

  if (req.rewritten)
    html.injectToHead(ast, {
      type: 'tag',
      name: 'base',
      attribs: {
        href: '//' + req.headers.host + path.dirname(files.relativePath(filename)) + '/'
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
        src: '/basisjs-tools/ws.js',
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

  return html.translate(ast);
}

function reqTransition(req){
  var start = req._initUrl;
  var sUrl = start.url;
  var eUrl = req.url;

  if (start.host !== req.headers.host)
  {
    sUrl = start.host + sUrl;
    eUrl = req.headers.host + eUrl;
  }

  return sUrl !== eUrl ? sUrl + chalk.gray(' → ') + eUrl : eUrl;
}

module.exports = function createServer(options, fsWatcher){
  function resolvePathnameFile(req, res, callback){
    var location = url.parse(req.url, true, true);
    var relFilename = location.pathname;
    var filename = files.absolutePath(relFilename);

    if (relFilename == '/favicon.ico' && !fs.existsSync(filename))
      return callback(__dirname + '/assets/favicon.ico');

    files.exists(filename, function(error){
      if (error)
      {
        logMsg('http',
          location.pathname + ' ' + chalk.bgRed.white('404') +
          (error && !options.verbose ? ' ' + chalk.gray(error) : '')
        );

        if (options.verbose)
        {
          logMsg('', 'full path: ' + filename);
          logMsg('', 'reason: ' + chalk.gray(error || 'file not found'));
        }

        if (req.headers['x-basis-resource'])
          fsWatcher.awaitFile(filename);

        res.writeHead(404);
        res.end('File ' + filename + ' not found');
        return;
      }

      if (fs.statSync(filename).isDirectory())
      {
        if (!/\/$/.test(location.pathname))
        {
          logMsg('http', location.pathname + ' redirect to ' + location.pathname + '/ ' + chalk.green('301'));

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

        logMsg('http', location.pathname + ' ' + chalk.bgRed.white('404'));
        res.writeHead(404);
        res.end('Path ' + filename + ' is not a file');

        return false;
      }

      return callback(filename);
    });
  }

  function normalizeFilename(filename){
    return path.resolve('/' + filename)
      // windows issues: cut drive in beginning and replaces `\` to `/`
      .replace(/^[a-z]:/i, '')
      .replace(/\\/g, '/');
  }

  function createPluginApi(api, name){
    api.addVirtualFile = function(filename, content){
      var filename =
        '/basisjs-tools/plugin:' +
        path.basename(path.dirname(name).replace(/^\.$/, '') || name) +
        normalizeFilename(filename);
      var contentType = mime.lookup(filename, 'text/plain');
      var file = {
        content: content,
        zip: {}
      };

      virtualPath.add(filename, function(api){
        api.log(chalk.green('(from cache)'));
        api.responseToClient(content, {
          contentType: contentType,
          encoding: api.encoding,
          file: file
        });
      });

      return filename;
    };
  }

  function getFileHandler(req, res){
    return function(err, filename, data){
      if (err)
      {
        res.writeHead(500);
        res.end('ERROR on file read: ' + err);
        return;
      }

      var file = files.get(filename);
      var contentType = mime.lookup(filename, 'text/plain');
      var isTextFile = /^text\/|^application\/(javascript|json|.+\+xml$)/.test(contentType);
      var responseOptions = {
        contentType: contentType + (isTextFile ? '; charset=utf-8' : ''),
        encoding: isTextFile && resolveEncoding(req), // gzip, deflate
        mtime: file.mtime,
        file: file,
        nocache: true
        //expires: contentType == 'text/html' ? 0 : 60 * 60 // 1 hour
      };


      if (options.resCache && req.headers['x-basis-resource'])
      {
        fsWatcher.startWatch(filename);
        files.addToCache(filename, String(data));
      }

      if (contentType == 'text/html')
        data = processHtml(req, filename, data, options);

      // logMsg('http', reqTransition(req) + ' ' + (data !== file.content ? chalk.yellow('(file read)') : chalk.green('(from cache)')));
      responseToClient(
        req,
        res,
        data,
        responseOptions,
        data !== file.content ? chalk.yellow('(file read)') : chalk.green('(from cache)')
      );
    };
  }

  function defaultRequestHandler(req, res){
    resolvePathnameFile(req, res, function(filename){
      var filename = path.normalize(filename);
      var relFilename = files.relativePath(filename);
      req.url = relFilename;

      if (!isContentModified(req, res, fs.statSync(filename).mtime))
        return;

      if (!options.readCache)
        files.remove(filename);

      files.readFileIfNeeded(filename, getFileHandler(req, res));
    });
  }

  function processRequest(req, res, middleware){
    logMsg('http', req.url + chalk.gray(' → ') + chalk.yellow(middleware.fn.name || '<noname-middleware>'), true);
    middleware.fn(req, res, function next(){
      if (middleware && middleware.next)
        processRequest(req, res, middleware.next);
    });
  }

  var requestProcessPipeline = {
    fn: defaultRequestHandler,
    next: null
  };

  var httpServer = http.createServer(function(req, res){
    req._initUrl = {
      host: req.headers.host,
      url: req.url
    };

    processRequest(req, res, requestProcessPipeline);
  }).on('error', function(error){
    console.log(
      chalk.bgRed.white('ERROR') + ' ' +
      (error.code == 'EADDRINUSE' ? 'Port ' + chalk.green(options.port) + ' already in use' : error)
    );
  });

  httpServer.addVirtualPath = virtualPath.add;
  httpServer.resolveEncoding = resolveEncoding;
  httpServer.isContentModified = isContentModified;
  httpServer.responseToClient = responseToClient;
  httpServer.use = function(middleware){
    requestProcessPipeline = {
      fn: middleware,
      next: requestProcessPipeline
    };
  };
  httpServer.log = function(message, verboseOnly){
    return logMsg('http', message, verboseOnly);
  };
  httpServer.warn = function(message){
    return logWarn('http', message);
  };
  httpServer.error = function(message){
    return logError('http', message);
  };

  httpServer.use(virtualPath.createMiddleware(httpServer));
  plugin.extendApi(createPluginApi);

  return httpServer;
};
