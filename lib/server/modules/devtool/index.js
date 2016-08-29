var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var logMsg = require('../utils').logMsg;
var genUID = require('../utils').genUID;
var ConnectionList = require('./ConnectionList');
var Client = require('./Client');

function packet(type, args){
  return [type].concat(Array.prototype.slice.call(args));
}

module.exports = function initDevtool(wsServer, httpServer, options){
  var clients = new ConnectionList(wsServer);
  // var inspectors = new ConnectionList(wsServer);
  var onClientConnectMode = null;
  var lastNum = 0;

  wsServer.addClientApi(path.join(__dirname, 'ws-client-api.js'));

  wsServer.on('connect', function(socket){
    //
    // client
    //
    socket.on('devtool:client connect', function(data, connectCallback){
      data = data || {};

      var clientId = data.clientId || genUID();
      var client = clients.get('id', clientId);

      if (!client)
      {
        client = new Client(clients, clientId, this, data);
        client.num = lastNum++;
      }
      else
      {
        client.update(data);
        client.setOnline(this);
      }

      this
        .on('devtool:client info', function(data){
          client.update(data);
          clients.notifyUpdates();
        })
        .on('devtool:client data', function(){
          var channel = socket.to(client.room);
          channel.emit.apply(channel, packet('devtool:session data', arguments));
        })
        .on('disconnect', function(){
          client.setOffline();
        });

      // connected and inited
      connectCallback({
        clientId: clientId,
        inspectors: client.inspectors.length,
        num: client.num
      });

      if (typeof onClientConnectMode == 'function')
        onClientConnectMode(client);
    });

    //
    // inspector
    //
    socket.on('devtool:inspector connect', function(connectCallback){
      this.on('devtool:pick client', function(pickCallback){
        function startIdentify(client){
          client.emitIfPossible('devtool:identify', client.num, function(){
            pickCallback(client.id);
            stopIdentify();
          });
        }
        function stopIdentify(){
          onClientConnectMode = null;
          socket.removeListener('disconnect', stopIdentify);
          socket.removeListener('devtool:cancel client pick', stopIdentify);
          clients.forEach(function(client){
            client.emitIfPossible('devtool:stop identify');
          });
        }

        onClientConnectMode = startIdentify;
        lastNum = 1;

        this.once('disconnect', stopIdentify);
        this.once('devtool:cancel client pick', stopIdentify);
        clients.forEach(function(client){
          client.num = lastNum++;
          startIdentify(client);
        });
        clients.notifyUpdates();
      });

      this.on('devtool:get client ui', function(clientId, callback){
        var client = clients.get('id', clientId);

        if (!client || !client.socket)
          return callback('[devtool:get client ui] Client (' + clientId + ') not found or disconnected');

        client.emit('devtool:get ui', {
          dev: options.dev,
          accept: ['script', 'url']
        }, callback);
      });

      connectCallback({
        clients: clients.getList()
      });
    });

    //
    // session observer
    //
    socket.on('devtool:join session', function(clientId, callback){
      var client = clients.get('id', clientId);

      if (!client || !client.socket)
        return callback('[devtool:join session] Client (' + clientId + ') not found or disconnected');

      client.addInspector(this);
      this
        .join(client.room)
        .on('devtool:to session', function(){
          client.emit.apply(client, packet('devtool:to session', arguments));
        })
        .on('disconnect', function(){
          client.removeInspector(this);
        }.bind(this));
    });
  });

  if (options.dev || !fs.existsSync(path.join(__dirname, 'client/dist/index.html')))
  {
    console.warn('Init ' + chalk.yellow('dev version') + ' of ' + chalk.yellow('devtool'));
    httpServer.addSymlink('/basisjs-tools/basis', path.dirname(require.resolve('basisjs')));
    httpServer.addSymlink('/basisjs-tools/devtool', path.join(__dirname, 'client/src'));
  }
  else
  {
    logMsg('ws', 'Init ' + chalk.green('build version') + ' of ' + chalk.yellow('devtool'), true);
    httpServer.addSymlink('/basisjs-tools/devtool', path.join(__dirname, 'client/dist'));
  }
};
