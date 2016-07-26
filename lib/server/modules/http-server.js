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
var files = require('./files');
var virtualPath = require('./virtualPath');

function isContentModified(req, res, date){
  if (req.headers['if-modified-since'])
  {
    var headerDate = parseInt(new Date(req.headers['if-modified-since']) / 1000);
    var contentDate = parseInt(date / 1000);

    if (isNaN(headerDate))
    {
      logWarn('Invalid date in If-Modified-Since header');
      headerDate = Infinity; // cheapest way response with no changed
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

function processHtml(data, options, rebase){
  var ast = html.parse(String(data), { location: false });

  if (rebase)
    html.injectToHead(ast, {
      type: 'tag',
      name: 'base',
      attribs: {
        href: rebase
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

module.exports = function createServer(options, rewriteRequest, fsWatcher){
  function resolvePathnameFile(req, res, filename, location, callback){
    var relFilename = files.relativePath(filename);

    if (virtualPath.has(relFilename))
      return virtualPath.get(relFilename)({
        location: location,
        path: relFilename,
        encoding: resolveEncoding(req),
        isContentModified: function(date){
          return isContentModified(req, res, date);
        },
        responseToClient: function(content, headers){
          return responseToClient(res, content, headers || {});
        },
        serverError: function(message){
          logMsg('client', relFilename + ' ' + chalk.red('500'));
          res.writeHead(500);
          res.end(message || 'Error');
        },
        logMsg: function(message){
          return logMsg('client', relFilename + ' ' + message);
        },
        logWarn: function(message){
          return logWarn('client', relFilename + ' ' + message);
        }
      });

    if (relFilename == '/favicon.ico' && !fs.existsSync(filename))
      return callback(__dirname + '/assets/favicon.ico');

    files.exists(filename, function(error){
      if (error)
      {
        logMsg('client',
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

  function getFileHandler(fres, req, res){
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
        data = processHtml(
          data,
          options,
          fres.rewritten ? '//' + req.headers.host + path.dirname(files.relativePath(filename)) + '/' : false
        );

      responseToClient(res, data, responseOptions);
    };
  }

  return http.createServer(function(req, res){
    var reqLocation = url.parse('//' + req.headers.host + req.url, true, true);
    var location = rewriteRequest(reqLocation, req, res);

    if (!location)
      return;

    resolvePathnameFile(req, res, files.absolutePath(location.pathname), location, function(fres){
      if (typeof fres == 'string')
        fres = {
          filename: fres
        };

      var filename = path.normalize(fres.filename);
      var relFilename = files.relativePath(filename);
      var pathname = location.pathname + (relFilename != location.pathname ? ' -> ' + relFilename : '');

      if (!isContentModified(req, res, fs.statSync(filename).mtime))
      {
        logMsg('client', pathname + ' ' + chalk.green('304'));
        return;
      }

      fres.rewritten = reqLocation.href != location.href;

      if (options.readCache)
      {
        var file = files.get(filename);
        if (file && fsWatcher.isFileObserve(filename) && file.content != null)
        {
          logMsg('client', pathname + ' ' + chalk.green('(from cache)'));
          getFileHandler(fres, req, res)(null, filename, file.content);
          return;
        }
      }

      logMsg('client', pathname + ' ' + chalk.yellow('(file read)'));
      files.readFileIfNeeded(filename, getFileHandler(fres, req, res));
    });
  }).on('error', function(error){
    console.log(
      chalk.bgRed.white('ERROR') + ' ' +
      (error.code == 'EADDRINUSE' ? 'Port ' + chalk.green(options.port) + ' already in use' : error)
    );
  });
};
