var fs = require('fs');
var chalk = require('chalk');
var socket_io = require('socket.io');
var virtualPath = require('./virtualPath');
var logMsg = require('./utils').logMsg;
var files = require('./files');

function assemblyClientApiScript(clientApiFiles, result, fromCache, callback){
  if (!clientApiFiles.length)
    return callback(null, result, fromCache);

  files.readFileIfNeeded(clientApiFiles[0], function(err, filename, content){
    if (err)
      return callback('(' + filename + '): ' + err);

    result += content;
    if (files.get(filename).content !== content)
      fromCache = false;

    assemblyClientApiScript(clientApiFiles.slice(1), result, fromCache, callback);
  });
}

function serveClientApi(api, clientApiFiles){
  var mtime = new Date(Math.max.apply(null, clientApiFiles.map(function(filename){
    return fs.statSync(filename).mtime;
  })));

  if (api.isContentModified(mtime))
    assemblyClientApiScript(clientApiFiles, '', true, function(err, content, fromCache){
      if (err)
        return api.serverError('Can\'t read file ' + err);

      api.logMsg(fromCache ? chalk.green('(from cache)') : chalk.yellow('(read)'));
      api.responseToClient(content, {
        contentType: 'application/javascript',
        mtime: mtime
      });
    });
  else
    api.logMsg(chalk.green('304'));
}

module.exports = function createWsServer(httpServer){
  var wsServer = socket_io(httpServer, { serveClient: false });
  var clientCount = 0;
  var clientApiFiles = [
    require.resolve('socket.io-client/socket.io.js')
  ];

  wsServer.hasClients = function(){
    return clientCount > 0;
  };

  wsServer.addClientApi = function(filename){
    clientApiFiles.push(filename);
  };

  wsServer.sockets.on('connection', function(socket){
    logMsg('socket', 'client ' + chalk.green('connected') + ' ' + chalk.gray(socket.id));
    clientCount++;

    socket.on('disconnect', function(){
      logMsg('socket', 'client ' + chalk.yellow('disconnected') + ' ' + chalk.gray(socket.id));
      clientCount--;
    });
  });

  // client-side API
  virtualPath.add('/basisjs-tools/ws.js', function(api){
    serveClientApi(api, clientApiFiles);
  });

  return wsServer;
};
