var fs = require('fs');
var chalk = require('chalk');
var socket_io = require('socket.io');
var files = require('../files');
var logMsg = require('../utils').logMsg;
var virtualPath = require('../virtualPath');

module.exports = function createServer(httpServer, options){
  var syncServer = socket_io(httpServer, { serveClient: false });
  var clientCount = 0;

  function broadcast(type, data){
    syncServer.emit(type, data);
  }

  virtualPath.add('/basisjs-tools/fileSync.js', function(api){
    var socketIOClientfilename = require.resolve('socket.io-client/socket.io.js');
    var clientFilename = __dirname + '/client.js';
    var mtime = new Date(Math.max(
      fs.statSync(socketIOClientfilename).mtime,
      fs.statSync(clientFilename).mtime
    ));

    if (api.isContentModified(mtime))
    {
      var fromCache = true;
      var errHandler = function(err, filename){
        api.serverError('Can\'t read file (' + filename + '): ' + err);
      };

      files.readFileIfNeeded(clientFilename, function(err, fn, clientScript){
        if (err)
          return errHandler(err, fn);

        if (files.get(fn).content !== clientScript)
          fromCache = false;

        files.readFileIfNeeded(socketIOClientfilename, function(err, fn, socketIO){
          if (err)
            return errHandler(err, fn);

          if (files.get(fn).content !== socketIO)
            fromCache = false;

          api.logMsg(fromCache ? chalk.green('(from cache)') : chalk.yellow('(read)'));
          api.responseToClient(socketIO + clientScript, {
            contentType: 'application/javascript',
            mtime: mtime
          });
        });
      });
    }
    else
      api.logMsg(chalk.green('304'));
  });

  syncServer.sockets.on('connection', function(socket){
    logMsg('socket', 'client ' + chalk.yellow('connected'));
    clientCount++;

    socket.on('saveFile', require('./command/saveFile.js')(options, broadcast));
    socket.on('createFile', require('./command/createFile.js')(options, broadcast));
    socket.on('readFile', require('./command/readFile.js')(options, broadcast));

    socket.on('openFile', require('./command/openFile.js')(options, broadcast));
    socket.on('getFileGraph', require('./command/getFileGraph.js')(options, broadcast));
    socket.on('handshake', require('./command/handshake.js')(options, broadcast));

    socket.on('disconnect', function(){
      logMsg('socket', 'client ' + chalk.yellow('disconnected'));
      clientCount--;
    });
  });


  files.onRead(function(err, filename, content, digest){
    if (err)
      return;

    var file = files.get(filename);
    var relFilename = files.relativePath(filename);

    if (!clientCount || /^basisjs-tools:/.test(relFilename))
      return;

    if (file.notify && file.content !== content)
    {
      logMsg('bcast', chalk.green('updateFile') + ' ' + relFilename);
      broadcast('updateFile', {
        filename: relFilename,
        digest: digest,
        content: file.content
      });
    }

    if (file.warmup)
    {
      file.warmup = false;
      file.notify = true;

      if (!options.verbose)
      {
        var attrs = files.attrs(file).join(', ');

        logMsg('info', relFilename + ' ' + chalk.green('(warm up)') + (attrs ? ' ' + chalk.gray(attrs) : ''));
      }
    }
  });
  files.onRemove(function(filename){
    var file = files.get(filename);
    var relFilename = files.relativePath(filename);

    if (file && file.notify)
    {
      logMsg('bcast', chalk.red('deleteFile') + ' ' + relFilename);
      broadcast('deleteFile', {
        filename: relFilename
      });
    }
  });

  return syncServer;
};
