var path = require('path');
var genUID = require('../utils').genUID;
var ConnectionList = require('./ConnectionList');
var Client = require('./Client');

module.exports = function initDevtool(wsServer, options){
  var clients = new ConnectionList(wsServer);
  // var inspectors = new ConnectionList(wsServer);
  var onClientConnectMode = null;
  var lastNum = 0;

  wsServer.addClientApi(path.join(__dirname, 'ws-client-api.js'));

  wsServer.on('connect', function(socket){
    // temporary here
    socket.on('basisjs.devpanel.command', function(data){
      socket.broadcast.emit('basisjs.devpanel.command', data);
    });
    socket.on('basisjs.devpanel.data', function(data){
      socket.broadcast.emit('basisjs.devpanel.data', data);
    });

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

      this.on('devtool:client info', function(data){
        client.update(data);
        clients.notifyUpdates();
      });
      this.once('disconnect', function(){
        client.setOffline();
      });

      // connected and inited
      connectCallback({
        clientId: clientId,
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
          client.emit('devtool:identify', client.num, function(){
            pickCallback(client.id);
            stopIdentify();
          });
        }
        function stopIdentify(){
          onClientConnectMode = null;
          socket.removeListener('disconnect', stopIdentify);
          socket.removeListener('devtool:cancel client pick', stopIdentify);
          clients.forEach(function(client){
            if (client.socket)
              client.emit('devtool:stop identify');
          });
        }

        onClientConnectMode = startIdentify;
        lastNum = 1;

        this.once('disconnect', stopIdentify);
        this.once('devtool:cancel client pick', stopIdentify);
        clients.forEach(function(client){
          client.num = lastNum++;
          if (client.socket)
            startIdentify(client);
        });
        clients.notifyUpdates();
      });

      this.on('devtool:get client ui', function(clientId, callback){
        var client = clients.get('id', clientId);

        if (!client || !client.socket)
        {
          callback('[devtool:get client ui] Client (' + clientId + ') not found or disconnected');
          return;
        }

        client.emit('devtool:get ui', callback);
      });

      connectCallback(clients.getList());
    });
  });
};
