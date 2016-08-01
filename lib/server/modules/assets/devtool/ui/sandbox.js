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
      this.element.contentWindow.eval('socket=top.socket;' + this.code + ';console.log("Inited")');
  }
});

module.exports = new Node({
  loading: new Value(false),

  template: resource('./template/sandbox.tmpl'),
  binding: {
    hasClient: Value.query('target').as(Boolean),
    loading: 'loading',
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
      transport.getClientUI(this.data.id, function(code){
        this.loading.set(false);
        if (this.data.ui != null)
          this.setSatellite('frame', new Frame({
            code: code
          }));
      }.bind(this));
    }
  }
});
