var path = require('path');
var logError = require('../utils').logError;
var logWarn = require('../utils').logWarn;

var TTL = 15 * 60 * 1000; // 15 min offline -> remove from client list
var CLIENT_FIELDS = {
  title: '[no title]',
  location: '[unknown]',
  devpanel: false
};

/**
* Generates unique id.
* random() + performance.now() + Date.now()
* @param {number=} len Required length of id (16 by default).
* @returns {string} Generated id.
*/
function genUID(len){
  function base36(val){
    return parseInt(Number(val), 10).toString(36);
  }

  var result = (global.performance ? base36(global.performance.now()) : '') + base36(new Date);

  if (!len)
    len = 16;

  while (result.length < len)
    result = base36(1e12 * Math.random()) + result;

  return result.substr(result.length - len, len);
}

function ClientList(server){
  this.clients = [];
  this.server = server;
}
ClientList.prototype = {
  get: function(property, value){
    for (var i = 0; i < this.clients.length; i++)
      if (this.clients[i][property] === value)
        return this.clients[i];
    return null;
  },
  add: function(client){
    if (this.clients.indexOf(client) === -1)
    {
      this.clients.push(client);
      this.notifyUpdates();
    }
  },
  remove: function(client){
    var index = this.clients.indexOf(client);
    if (index !== -1)
    {
      this.clients.splice(index, 1);
      this.notifyUpdates();
    }
  },
  forEach: function(fn, context){
    this.clients.forEach(fn, context);
  },
  notifyUpdates: function(){
    // TODO: notify inspectors
    this.server.emit('devtool:clientList', this.getList());
  },
  broadcast: function(){
    var args = arguments;
    this.forEach(function(client){
      if (client.socket)
        client.emit.apply(client, args);
    });
  },
  getList: function(){
    return this.clients.map(function(client){
      var info = {};

      for (var key in CLIENT_FIELDS)
        info[key] = client[key];

      info.id = client.id;
      info.online = Boolean(client.socket);
      info.devpanel = client.socket ? client.devpanel : false;

      return info;
    });
  }
};

function Client(list, id, socket, data){
  this.list = list;
  this.id = id;
  this.num = 0;
  this.socket = socket;

  for (var key in CLIENT_FIELDS)
    this[key] = Object.prototype.hasOwnProperty.call(data, key)
      ? data[key]
      : CLIENT_FIELDS[key];

  this.list.add(this);
}
Client.prototype = {
  id: null,
  socket: null,

  offlineTime: null,
  update: function(data){
    for (var key in data)
      if (Object.prototype.hasOwnProperty.call(CLIENT_FIELDS, key))
        this[key] = data[key];
  },
  setOnline: function(socket){
    if (!this.socket)
    {
      clearTimeout(this.ttlTimer);
      this.offlineTime = null;
      this.socket = socket;
      this.list.notifyUpdates();
    }
  },
  setOffline: function(){
    if (this.socket)
    {
      this.socket = null;
      this.offlineTime = Date.now();
      this.list.notifyUpdates();
      this.ttlTimer = setTimeout(function(){
        if (!this.socket && (Date.now() - this.offlineTime) > TTL)
          this.list.remove(this);
      }.bind(this), TTL);
    }
  },
  send: function(action, args, callback){
    if (this.socket)
      this.socket.emit(action, args, callback);
    else
      callback('Client is offline');
  },
  emit: function(){
    if (this.socket)
      this.socket.emit.apply(this.socket, arguments);
    else
      logWarn('socket', 'Client ' + this.id + ' is offline');
  }
};

module.exports = function initDevtool(wsServer, options){
  function stopIdentify(){
    pickClientSocket = null;
    mode = '';
    clients.broadcast('devtool:stop identify');
  }

  var clients = new ClientList(wsServer);
  var mode = '';
  var lastNum = 0;
  var pickClientSocket;

  wsServer.addClientApi(path.join(__dirname, 'ws-client-api.js'));

  wsServer.on('connect', function(socket){
    socket.on('disconnect', function(){
      var client = clients.get('socket', this);
      if (client)
        client.setOffline();

      if (pickClientSocket === socket)
        stopIdentify();
    });

    // temporary here
    socket.on('basisjs.devpanel.command', function(data){
      socket.broadcast.emit('basisjs.devpanel.command', data);
    });
    socket.on('basisjs.devpanel.data', function(data){
      socket.broadcast.emit('basisjs.devpanel.data', data);
    });

    socket.on('devtool:handshake', function(data){
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

      this.emit('devtool:handshake', {
        clientId: clientId,
        mode: mode,
        num: client.num
      });
    });

    socket.on('devtool:info', function(data){
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

    socket.on('devtool:getClientList', function(callback){
      callback(clients.getList());
    });
    socket.on('devtool:pick client', function(){
      pickClientSocket = socket;
      mode = 'identify';
      lastNum = 1;
      clients.forEach(function(client){
        client.num = lastNum++;
        if (client.socket)
          client.emit('devtool:identify', client.num);
      });
    });
    socket.on('devtool:select me', function(clientId){
      pickClientSocket.emit('devtool:select client', clientId);
      stopIdentify();
    });

    var getBundle = require('../file-sync/command/getBundle')(options);
    socket.on('devtool:get client ui', function(clientId, callback){
      getBundle('/src/devpanel/index.html', callback);
    });
  });
};
