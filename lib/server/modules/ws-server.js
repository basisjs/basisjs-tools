var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var socket_io = require('socket.io');
var logMsg = require('./utils').logMsg;
var files = require('./files');
var commands = {};

function assemblyClientApiScript(clientApiFiles, result, fromCache, callback){
  if (!clientApiFiles.length)
    return callback(null, result, fromCache);

  files.readFileIfNeeded(clientApiFiles[0], function(err, filename, content){
    if (err)
      return callback('(' + filename + '): ' + err);

    result.push({
      filename: files.relativePath(filename),
      content: content
    });

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
    assemblyClientApiScript(clientApiFiles, [], true, function(err, files, fromCache){
      if (err)
        return httpApi.responseError(500, 'Can\'t read file ' + err);

      // first file use as is - it's socket.io-client
      // second file is client source wrapper
      // others inject in special place of second one
      var content = files[0].content + files.slice(2).reduce(function(result, file){
        return result.replace(
          '\n  // <!--inject-->',
          '(function(){\n' +
            file.content +
            '\n//# sourceURL=/' + file.filename +
          '\n})();' +
          '\n$&'
        );
      }, files[1].content);

      httpApi.responseToClient(content, {
        contentType: 'application/javascript',
        mtime: mtime
      }, fromCache ? chalk.green('(from cache)') : chalk.yellow('(read)'));
    });
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
    require.resolve('socket.io-client/socket.io.js'),
    require.resolve('./ws/client.js')
  ];

  wsServer.hasClients = function(){
    return clientCount > 0;
  };

  wsServer.addClientApi = function(filename){
    clientApiFiles.push(filename);
  };

  wsServer.sockets.on('connection', function(socket){
    logMsg('socket', 'client ' + chalk.yellow('connected') + ' ' + chalk.gray(socket.id));
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
  httpServer.addVirtualPath('/basisjs-tools/ws.js', function(httpApi){
    serveClientApi(httpApi, clientApiFiles);
  });

  httpServer.addVirtualPath('/basisjs-tools/socket.io.js', require.resolve('socket.io-client/socket.io.js'));
  httpServer.addSymlink('/basisjs-tools/basis', path.dirname(require.resolve('basisjs')));
  httpServer.addSymlink('/basisjs-tools/devtool', path.join(__dirname, 'devtool/client'));

  return wsServer;
}

module.exports = {
  create: createWsServer,
  addCommand: addCommand
};
