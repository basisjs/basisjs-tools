var path = require('path');
var logError = require('../utils').logError;
var genUID = require('../utils').genUID;
var ConnectionList = require('./ConnectionList');
var Client = require('./Client');

module.exports = function initDevtool(wsServer, options){
  var clients = new ConnectionList(wsServer);
  // var inspectors = new ConnectionList(wsServer);
  var mode = '';
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

    socket.on('devtool:client connect', function(data, callback){
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

      this.once('disconnect', function(){
        client.setOffline();
      });

      callback({
        clientId: clientId,
        mode: mode,
        num: client.num
      });
    });

    socket.on('devtool:client info', function(data){
      data = data || {};

      var clientId = data.clientId;
      var client = clients.get('id', clientId);

      if (!client)
      {
        logError('ws', 'Wrong client id (' + clientId + '), client info not found');
        return;
      }

      client.update(data);
      clients.notifyUpdates();
    });

    //
    // inspector
    //

    socket.on('devtool:inspector connect', function(callback){
      callback(clients.getList());
    });

    socket.on('devtool:pick client', function(){
      function stopIdentify(){
        mode = '';
        socket.removeListener('disconnect', stopIdentify);
        clients.forEach(function(client){
          if (client.socket)
          {
            client.socket.removeAllListeners('devtool:select me');
            client.emit('devtool:stop identify');
          }
        });
      }

      mode = 'identify';
      lastNum = 1;

      this.once('disconnect', stopIdentify);
      clients.forEach(function(client){
        client.num = lastNum++;
        if (client.socket)
        {
          client.emit('devtool:identify', client.num);
          client.socket.once('devtool:select me', function(clientId){
            socket.emit('devtool:select client', clientId);
            stopIdentify();
          });
        }
      });
    });

    var getBundle = require('../file-sync/command/getBundle')(options);
    socket.on('devtool:get client ui', function(clientId, callback){
      getBundle('/src/devpanel/index.html', callback);
    });
  });
};
