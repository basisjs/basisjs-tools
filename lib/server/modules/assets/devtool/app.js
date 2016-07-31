if (typeof io == 'undefined')
{
  console.warn('basisjs-tools: socket.io is not defined');
  return;
}

var Client = require('./type.js').Client;
var Node = require('basis.ui').Node;
var socket = io.connect(location.host, { transports: ['websocket', 'polling'] });

function syncClientList(data){
  Client.all.setAndDestroyRemoved(basis.array(data).map(Client.reader));
}

// connection events
socket.on('connect', function(){
  console.log('connected');
  socket.emit('devtool:getClientList', syncClientList);
});

socket.on('disconnect', function(){
  console.log('disconnected');
});

socket.on('devtool:clientList', syncClientList);

// common events
socket.on('error', function(err){
  console.error('basisjs-tools: Socket error:', (err && err.operation ? 'operation ' + err.operation + ': ' + err.message : err));
});

require('basis.app').create(new Node({
  template: '<div><!--{clients}-->',
  binding: {
    clients: require('./ui/clients.js')
  }
}));
