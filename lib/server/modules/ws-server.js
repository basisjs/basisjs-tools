var fs = require('fs');
var chalk = require('chalk');
var socket_io = require('socket.io');
var plugin = require('./plugin');
var files = require('./files');
var logMsg = require('./utils').logMsg;
var commands = {};
var socketEvents = [
  'error',
  'connect',
  'disconnect',
  'newListener',
  'removeListener'
];

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
          '\n(function(){\n' +
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

function getFeatures(socket){
  // EventEmmiter#eventNames implemented since node.js 6.0
  var events = socket.eventNames ? socket.eventNames() : Object.keys(socket._events);
  return events.filter(function(name){
    return socketEvents.indexOf(name) === -1;
  });
}

// extend plugin API
plugin.extendApi(function(api){
  api.addSocketCommand = addCommand;
});

module.exports = function createWsServer(httpServer, options){
  var wsServer = socket_io(httpServer, { serveClient: false });
  var clientCount = 0;
  var clientApiFiles = [
    require.resolve('socket.io-client/socket.io.js'),
    require.resolve('./ws/client.js')
  ];

  wsServer.hasClients = function(){
    return clientCount > 0;
  };

  wsServer.addCommand = addCommand;
  wsServer.addClientApi = function(filename){
    clientApiFiles.push(filename);
  };

  wsServer.on('connection', function(socket){
    logMsg('socket', 'client ' + chalk.yellow('connected') + ' ' + chalk.gray(socket.id));
    clientCount++;

    for (var name in commands)
      if (commands.hasOwnProperty(name))
        socket.on(name, commands[name]);

    socket
      .on('getAppProfile', require('./ws/getAppProfile')(options))
      .on('getBundle', require('./ws/getBundle')(options))
      .on('disconnect', function(){
        logMsg('socket', 'client ' + chalk.yellow('disconnected') + ' ' + chalk.gray(socket.id));
        clientCount--;
      });

    // socket.on('newListener', ...);
    socket.emit('features', getFeatures(socket));
  });

  // client-side API
  httpServer.addVirtualPath('/basisjs-tools/ws.js', function(httpApi){
    serveClientApi(httpApi, clientApiFiles);
  });

  return wsServer;
};
