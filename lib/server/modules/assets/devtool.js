if (typeof io == 'undefined')
{
  console.warn('basisjs-tools: socket.io is not defined');
  return;
}

var socket = io.connect(location.host, { transports: ['websocket', 'polling'] });

// connection events
socket.on('connect', function(){
  console.log('connected');
});

socket.on('disconnect', function(){
  console.log('disconnected');
});

// common events
socket.on('error', function(err){
  console.error('basisjs-tools: Socket error:', (err && err.operation ? 'operation ' + err.operation + ': ' + err.message : err));
});

var Node = require('basis.ui').Node;
require('basis.app').create(new Node({
  template: 'hello'
}));
