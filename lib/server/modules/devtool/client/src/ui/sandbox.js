var Value = require('basis.data').Value;
var Node = require('basis.ui').Node;
var transport = require('../transport.js');

var Frame = Node.subclass({
  template: resource('./template/sandbox-frame.tmpl'),
  binding: {
    random: basis.genUID
  },
  action: {
    ready: function(){
      this.ready = true;
      this.initUI();
    }
  },
  initUI: function(){
    if (this.ready && this.code && this.element)
      this.element.contentWindow.eval(
        'socket=top.io("", { transports: ["websocket", "polling"] });\n' +
        'socket.on("connect", function joinSession(){ socket.emit("devtool:join session", "' + this.clientId + '", function(err){ if (err) setTimeout(joinSession, 2000); }); });\n' +
        this.code +
        ';console.log("remove devtool inited")');
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
