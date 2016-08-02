var logWarn = require('../utils').logWarn;
var TTL = 15 * 60 * 1000; // 15 min offline -> remove from client list
var CLIENT_FIELDS = {
  title: '[no title]',
  location: '[unknown]'
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
  ttlTimer: null,

  update: function(data){
    for (var key in data)
      if (Object.prototype.hasOwnProperty.call(CLIENT_FIELDS, key))
        this[key] = data[key];
  },
  getData: function(){
    return {
      id: this.id,
      title: this.title,
      location: this.location,
      online: Boolean(this.socket),
      num: this.num
    };
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

module.exports = Client;
