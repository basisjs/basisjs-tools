/* eslint-env browser */
/* global io, basis, resource */

var Value = require('basis.data').Value;
var Node = require('basis.ui').Node;
var transport = require('../transport.js');
var sandboxApi = {};

function createSandboxAPI(client){
  function notify(type, args){
    for (var i = 0; i < subscribers[type].length; i++)
      subscribers[type][i].apply(null, args);
  }

  var apiId = this.apiId;
  var sessionId = Value.query(client, 'data.sessionId');
  var online = Value.query(client, 'data.online');
  var features = Value.query(client, 'data.features');
  var retryTimer;
  var subscribers = {
    data: [],
    session: [],
    connection: [],
    features: []
  };

  var socket = io('', { transports: ['websocket', 'polling'] })
    .on('connect', function joinSession(){
      socket.emit('devtool:join session', client.data.id, function(err){
        if (err)
          retryTimer = setTimeout(joinSession, 2000);
      });
    })
    .on('devtool:session data', function(){
      notify('data', arguments);
    });

  // destroy old API
  if (sandboxApi[apiId])
    sandboxApi[apiId]();

  sandboxApi[apiId] = function destroyApi(){
    delete sandboxApi[apiId];
    clearTimeout(retryTimer);
    sessionId.unlink(subscribers);
    online.unlink(subscribers);
    features.unlink(subscribers);
    socket.close();
    socket = null;
  };

  sessionId.link(subscribers, function(sessionId){
    notify('session', [sessionId]);
  });
  online.link(subscribers, function(online){
    notify('connection', [online]);
  });
  features.link(subscribers, function(features){
    notify('features', [features]);
  });

  return {
    send: function(){
      socket.emit.apply(socket, ['devtool:to session'].concat(basis.array(arguments)));
    },
    subscribe: function(channel, fn){
      if (typeof channel === 'function')
      {
        fn = channel;
        channel = 'data';
      }

      if (!subscribers.hasOwnProperty(channel))
        return console.warn('[remote inspector] Unknown channel name: ' + channel);

      subscribers[channel].push(fn);

      switch (channel) {
        case 'session':
          fn(client.data.sessionId);
          break;
        case 'connection':
          fn(client.data.online);
          break;
        case 'features':
          fn(client.data.features);
          break;
      }

      return this;
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
      return node.url ? node.url + '#' + node.apiId : 'javascript:"<html></html>"';
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

      // set hash via location.href since Firefox fails on location.hash changing
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1127895#c5
      contentWindow.location.href += '#' + this.apiId;
      contentWindow.eval(this.script + ';console.log("Remote devtool client (' + (this.url || 'script') + ') inited");');
    }
  },

  init: function(){
    Node.prototype.init.call(this);
    this.apiId = basis.fn.publicCallback(
      createSandboxAPI.bind(this, this.client),
      true
    );
  },
  destroy: function(){
    // teardown socket connection
    var destroyApi = this.apiId && sandboxApi[this.apiId];
    if (destroyApi)
      destroyApi();

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
            client: this,
            url: type === 'url' ? content : null,
            script: type === 'script' ? content : ''
          }));
      }.bind(this));
    }
  }
});
