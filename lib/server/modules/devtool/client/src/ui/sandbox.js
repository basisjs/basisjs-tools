var Value = require('basis.data').Value;
var Node = require('basis.ui').Node;
var transport = require('../transport.js');

var createSandboxSocket = basis.fn.publicCallback(function(clientId){
  var subscribers = [];
  var socket = io('', { transports: ['websocket', 'polling'] })
    .on('connect', function joinSession(){
      this.emit('devtool:join session', clientId, function(err){
        if (err)
          setTimeout(joinSession, 2000);
      });
    })
    .on('devtool:session data', function(){
      var args = arguments;
      subscribers.forEach(function(fn){
        fn.apply(null, args);
      });
    });

  return {
    socket: socket,
    send: function(){
      socket.emit.apply(socket, ['devtool:session command'].concat(basis.array(arguments)));
    },
    subscribe: function(fn){
      subscribers.push(fn);
    }
  };
}, true);

var Frame = Node.subclass({
  template: resource('./template/sandbox-frame.tmpl'),
  binding: {
    random: basis.genUID
  },
  action: {
    ready: function(){
      if (this.ready)
        return;

      this.ready = true;
      this.initUI();
    }
  },
  initUI: function(){
    if (this.ready && this.code && this.element)
      // run remote devtool code in sandbox and get created socket for future teardown
      this.socket = this.element.contentWindow.eval(
        'window.devtoolApi = top.' + createSandboxSocket + '("' + this.clientId + '");\n' +
        this.code +
        ';console.log("remote devtool inited");\n' +
        'window.devtoolApi.socket'
      );
  },
  destroy: function(){
    // teardown document and socket connection
    if (this.socket)
      this.socket.close();

    this.socket = null;
    this.element.setAttribute('srcdoc', '');
    this.element.setAttribute('src', '');

    Node.prototype.destroy.call(this);
  }
});

module.exports = new Node({
  loading: new basis.Token(false),
  error: new basis.Token(false),

  template: resource('./template/sandbox.tmpl'),
  binding: {
    hasClient: Value.query('target').as(Boolean),
    loading: 'loading',
    error: 'error',
    online: 'data:',
    title: 'data:',
    location: 'data:',
    frame: 'satellite:'
  },
  action: {
    drop: function(){
      this.owner.dropSelection();
    }
  },

  handler: {
    update: function(sender, delta){
      if ('code' in delta)
        this.syncUI();
    },
    targetChanged: function(){
      this.syncUI();
    }
  },

  syncUI: function(){
    if (this.satellite.frame)
      this.satellite.frame.destroy();

    if (this.target)
    {
      this.loading.set(true);
      this.error.set();
      transport.getClientUI(this.data.id, function(err, code){
        this.loading.set(false);
        if (err)
          this.error.set(err);
        else if (this.data.ui != null)
          this.setSatellite('frame', new Frame({
            clientId: this.data.id,
            code: code
          }));
      }.bind(this));
    }
  }
});
