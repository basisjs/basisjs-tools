/* eslint-env browser */
/* global io, basis */
var Value = require('basis.data').Value;
var Client = require('./type.js').Client;
var online = new Value({ value: false });
var socket = io.connect(location.host, { transports: ['websocket', 'polling'] });

function syncClientList(data){
  Client.all.setAndDestroyRemoved(basis.array(data).map(Client.reader));
}

// connection events
socket.on('connect', function(){
  console.log('basisjs-tools[Client Inspector]: connected');
  socket.emit('devtool:inspector connect', function(clientList){
    syncClientList(clientList);
    online.set(true);
  });
});

socket.on('disconnect', function(){
  online.set(false);
  console.log('basisjs-tools[Client Inspector]: disconnected');
});

socket.on('devtool:clientList', syncClientList);

// common events
socket.on('error', function(err){
  console.error('basisjs-tools[Client Inspector]: Socket error:', (err && err.operation ? 'operation ' + err.operation + ': ' + err.message : err));
});

module.exports = {
  online: online,
  getClientUI: function(clientId, callback){
    socket.emit('devtool:get client ui', clientId, function(err, code){
      Client(clientId).set('ui', code);
      callback(code);
    });
  },
  pickClient: function(callback){
    socket.emit('devtool:pick client', callback);
  },
  cancelClientPick: function(){
    socket.emit('devtool:cancel client pick');
  }
};
