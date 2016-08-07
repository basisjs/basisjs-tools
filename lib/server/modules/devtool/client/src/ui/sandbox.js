/* eslint-env browser */
/* global io, basis, resource */

var Value = require('basis.data').Value;
var Node = require('basis.ui').Node;
var transport = require('../transport.js');
var sandboxSockets = {};

function createSandboxAPI(clientId){
  var subscribers = [];
  var socket = io('', { transports: ['websocket', 'polling'] })
    .on('connect', function joinSession(){
      this.emit('devtool:join session', clientId, function(err){
        if (err)
          setTimeout(joinSession, 2000);
      });
    })
    .on('devtool:session data', function(){
      for (var i = 0; i < subscribers.length; i++)
        subscribers[i].apply(null, arguments);
    });

  // disconnet old socket
  if (sandboxSockets[this.socketId])
    sandboxSockets[this.socketId].close();

  sandboxSockets[this.socketId] = socket;

  return {
    send: function(){
      socket.emit.apply(socket, ['devtool:session command'].concat(basis.array(arguments)));
    },
    subscribe: function(fn){
      subscribers.push(fn);
    }
  };
};

var Frame = Node.subclass({
  type: null,
  script: null,

  template: resource('./template/sandbox-frame.tmpl'),
  binding: {
    random: basis.genUID,
    srcdoc: function(node){
      if (!node.url)
        return '<html></html>';
    },
    src: function(node){
      return node.url ? node.url + '#' + node.socketId : 'javascript:"<html></html>"';
    }
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
    if (this.ready && this.element)
    {
      // run remote devtool code in sandbox and get created socket for future teardown
      var contentWindow = this.element.contentWindow;

      contentWindow.location.hash = this.socketId;
      contentWindow.eval(this.script + ';console.log("Remote devtool client (' + (this.url || 'script') + ') inited");');
    }
  },

  init: function(){
    Node.prototype.init.call(this);
    this.socketId = basis.fn.publicCallback(
      createSandboxAPI.bind(this, this.clientId),
      true
    );
  },
  destroy: function(){
    // teardown socket connection
    var socket = this.socketId && sandboxSockets[this.socketId];
    if (socket)
    {
      delete sandboxSockets[this.socketId];
      socket.close();
    }

    // teardown document
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
    // update: function(sender, delta){
    //   if ('uiContent' in delta)
    //     this.syncUI();
    // },
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
      transport.getClientUI(this.data.id, function(err, type, content){
        this.loading.set(false);
        if (err)
          this.error.set(err);
        else if (this.data.uiContent != null)
          this.setSatellite('frame', new Frame({
            clientId: this.data.id,
            url: type === 'url' ? content : null,
            script: type === 'script' ? content : ''
          }));
      }.bind(this));
    }
  }
});
