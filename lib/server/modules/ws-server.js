var fs = require('fs');
var chalk = require('chalk');
var socket_io = require('socket.io');
var virtualPath = require('./virtualPath');
var logMsg = require('./utils').logMsg;
var logWarn = require('./utils').logWarn;
var files = require('./files');
var commands = {};

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

function serveClientApi(httpApi, clientApiFiles){
  var mtime = new Date(Math.max.apply(null, clientApiFiles.map(function(filename){
    return fs.statSync(filename).mtime;
  })));

  if (httpApi.isContentModified(mtime))
    assemblyClientApiScript(clientApiFiles, '', true, function(err, content, fromCache){
      if (err)
        return httpApi.serverError('Can\'t read file ' + err);

      httpApi.log(fromCache ? chalk.green('(from cache)') : chalk.yellow('(read)'));
      httpApi.responseToClient(content, {
        contentType: 'application/javascript',
        mtime: mtime
      });
    });
  else
    httpApi.log(chalk.green('304'));
}

function addCommand(name, fn){
  if (commands.hasOwnProperty(name))
    throw new Error('WS command `' + name + '` is already in use');

  commands[name] = fn;
}

function createWsServer(httpServer){
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

    for (var name in commands)
      if (commands.hasOwnProperty(name))
        socket.on(name, commands[name]);

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
}

module.exports = {
  create: createWsServer,
  addCommand: addCommand
};
