
var http = require('http');
var fs = require('fs');
var url = require('url');
var path = require('path');
var socket_io = require('socket.io');
var mime = require('mime');
var zlib = require('zlib');

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

  // check base path
  if (!fs.existsSync(BASE_PATH))
  {
    console.warn('Base path `' + BASE_PATH + '` not found');
    process.exit();
  }

  if (options.rewrite)
  {
    try {
      httpProxy = require('http-proxy');
      for (var key in options.rewrite)
      {
        rewriteRules.push({
          msg: '/' + key + '/ -> ' + options.rewrite[key],
          re: new RegExp(key),
          replace: options.rewrite[key]
        });
      }
    } catch(e) {
      console.warn('  Proxy is not supported (requires http-proxy). Rewrite rules ignored.');
    }
  }


  //
  // Proxy
  //
  function proxyRequest(req, res, pathname){
    for (var i = 0, rule; rule = rewriteRules[i]; i++)
    {
      if (rule.re.test(pathname))
      {
        if (!proxy)
        {
          proxy = new httpProxy.HttpProxy({
            target: {
              host: 'localhost',
              port: 80
            }
          });
        }

        //console.log(re);
        proxy.proxyRequest(req, res);
        return true;
      }
    }
  }

  //
  // Cache
  //
  var hotStartCache = (function(){
    var cache = {};
    var content;
    var invalidate = false;

    function rebuild(){
      content = new String(JSON.stringify(cache, null, 2));
      content.mtime = new Date;
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
  var virtualPath = {
    '/FDF31FF4-1532-421C-A865-99D0E77ADE04.js': function(req, res){
      var content = hotStartCache.get();
      if (!contentIsNotModified(req, res, content.mtime))
      {
        responseToClient(res, 'window.__resources__ = ' + content, {
          contentType: 'text/javascript',
          mtime: content.mtime,
          encoding: resolveEncoding(req)/*,
          expires: 1 // 1 min*/
        });
      }
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

    if (!fs.existsSync(filename))
    {
      res.writeHead(404);
      res.end('File ' + filename + ' not found');
      return false;
    }

    var fileStat = fs.statSync(filename);
    if (fileStat.isDirectory())
    {
      if (!/\/$/.test(location.pathname))
      {
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

      res.writeHead(404);
      res.end('Path ' + filename + ' is not a file');
      return false;
    }

    return filename;
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
      zlib[options.encoding](content, function(er, content){
        if (er)
        {
          res.writeHead(500);
          res.end('Error while content compression: ' + er);
        }
        else
        {
          res.writeHead(200, headers);
          res.end(content);
        }
      });
    }
    else
    {
      res.writeHead(200, headers);
      res.end(content);
    }
  }

  function resolveEncoding(req){
    return req.headers['accept-encoding'] ? req.headers['accept-encoding'].toLowerCase().replace(/^.*?\b(gzip|deflate)\b.*$|.*()/, '$1$2') : '';
  }

  //
  // Server
  //
  var httpServer = http.createServer(function(req, res){
    var location = url.parse(req.url, true, true);
    var pathname = location.pathname.slice(1);

    //proxy request if nececcary
    if (proxyRequest(req, res, pathname))
      return;

    // resolve filename
    var filename = resolvePathnameFile(req, res, path.normalize(BASE_PATH + location.pathname), location);
    var fnKey = normPath(''+filename);

    console.log('[CLIENT] request', location.pathname); // fnKey || ('unknown path ' + location.pathname));

    if (filename)
    {
      var fileStat = fs.statSync(filename);

      if (contentIsNotModified(req, res, fileStat.mtime))
        return;

      function processFile(err, data){
        if (err)
        {
          res.writeHead(500);
          res.end('Can\'t read file ' + filename + ', error: ' + err);
          return
        }

        // no errors
        var contentType = mime.lookup(filename, 'text/plain');
        var responseOptions = {
          contentType: contentType,
          encoding: /^(text\/|application\/)/.test(contentType) && resolveEncoding(req),
          mtime: fileStat.mtime,
          expires: 60 * 60 // 1 hour
        };

        var ext = path.extname(filename);

        if (hotStartExtensions.indexOf(ext) != -1 && ignorePathes.indexOf(path.normalize(filename)) == -1)
          hotStartCache.add(fnKey, String(data));

        if (contentType == 'text/html')
        {
          var fileContent = String(data).replace(/<head>/i, '<head><script src="/FDF31FF4-1532-421C-A865-99D0E77ADE04.js"></script>');

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

      if (fileMap[fnKey] && fileMap[fnKey].content != null)
        processFile(null, fileMap[fnKey].content);
      else
        fs.readFile(filename, processFile);
    }
  });

  //create server
  console.log('Start server');

  httpServer.listen(options.port, function(){
    var port = httpServer.address().port;
    console.log([
      'Server is online, listen for http://localhost:' + port,
      (options.sync ? 'Watching changes for path: ' + BASE_PATH : 'No watching for FS'),
      'Ignore pathes:\n  ' + ignorePathes.join('\n  ') +
      (rewriteRules
        ? '\nRewrite rules:\n  ' + rewriteRules.map(function(rule){ return rule.msg }).join('\n  ')
        : '')
    ].join('\n') + '\n------------');
  });

  //
  // Messaging
  //

  if (!options.sync)
    return;

  var io = socket_io.listen(httpServer);
  io.disable('log');

  io.sockets.on('connection', function(socket){
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
            var newContent = String(data).replace(/\r\n?|\n\r?/g, '\n');

            var newFileInfo = {
              filename: normPath(filename),
              lastUpdate: fileInfo.mtime
            };

            if (newContent !== fileInfo.content)
              fileInfo.content = newContent;

            newFileInfo.content = newContent;

            if (fileInfo.notify)
              updateCallback(newFileInfo);

            if (fileInfo.hotStart && hotStartCache.isRequire(fnKey))
              hotStartCache.add(fnKey, newContent);
          }
          else
            console.log('[FS] Error: Can\'t read file ' + filename + ': ' + err);
        });
      }
    }

    function updateStat(filename){
      filename = path.normalize(filename);

      fs.stat(filename, function(err, stats){
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

              createCallback({
                filename: normPath(filename),
                type: fileType,
                lastUpdate: stats.mtime
              });
            }

            if (fileType == 'dir')
            {
              //console.log(filename, path.normalize(filename));
              if (ignorePathes.indexOf(path.normalize(filename)) == -1)
                lookup(filename);
            }
            else
            {
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
                delete fileMap[fnKey];

                hotStartCache.remove(fnKey);

                // event!!
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