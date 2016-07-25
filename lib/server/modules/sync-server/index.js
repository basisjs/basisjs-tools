var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var socket_io = require('socket.io');
var files = require('../files');
var logMsg = require('../utils').logMsg;
var relPathBuilder = require('../utils').relPathBuilder;
var virtualPath = require('../virtualPath');
var fsWatcher = require('../watch');
var hotStartCache = require('../resourceCache');

module.exports = function createServer(httpServer, options){
  var syncServer = socket_io(httpServer, { serveClient: false });
  var clientCount = 0;
  var normPath = relPathBuilder(options.base);

  function broadcast(type, data){
    syncServer.emit(type, data);
  }

  virtualPath.add('/basisjs-tools/fileSync.js', function(api){
    var socketIOClientfilename = require.resolve('socket.io-client/socket.io.js');
    var filename = __dirname + '/client.js';
    var mtime = new Date(Math.max(
      fs.statSync(socketIOClientfilename).mtime,
      fs.statSync(filename).mtime
    ));

    if (api.isContentModified(mtime))
    {
      var errHandler = function(err, filename){
        api.serverError('Can\'t read file (' + filename + '): ' + err);
      };

      files.readFile(filename, function(err, fileSyncData, fn){
        if (err)
          return errHandler(err, fn);

        files.readFile(socketIOClientfilename, function(err, data, fn){
          if (err)
            return errHandler(err, fn);

          api.logMsg(chalk.yellow('(read)'));

          api.responseToClient(data + fileSyncData, {
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
  });

  syncServer.sockets.on('disconnect', function(socket){
    logMsg('socket', 'client ' + chalk.yellow('disconnected'));
    clientCount--;
  });

  files.onRead(function(err, data, filename){
    if (err)
      return;

    var fileInfo = files.getInfo(filename, true);
    var fnKey = normPath(filename);

    if (fileInfo.notify)
    {
      if (!clientCount || /^basisjs-tools:/.test(fnKey))
        return;

      logMsg('bcast', chalk.green('updateFile') + ' ' + fnKey);
      syncServer.emit('updateFile', {
        filename: fnKey,
        content: fileInfo.content
      });
    }
  });
  files.onRemove(function(filename){
    var fileInfo = files.getInfo(filename);
    var fnKey = normPath(filename);

    if (fileInfo && fileInfo.notify)
    {
      logMsg('bcast', chalk.red('deleteFile') + ' ' + fnKey);
      syncServer.emit('deleteFile', {
        filename: fnKey
      });
    }
  });

  return syncServer;
};
