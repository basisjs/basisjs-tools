var Value = require('basis.data').Value;
var Node = require('basis.ui').Node;
var transport = require('../transport.js');

module.exports = new Node({
  template: resource('./template/layout.tmpl'),
  binding: {
    clients: 'satellite:',
    sandbox: 'satellite:'
  },
  action: {
    pick: function(){
      transport.pickClient();
    }
  },
  satellite: {
    clients: require('./clients.js'),
    sandbox: {
      delegate: Value.query('satellite.clients.<static>selectedClient'),
      instance: require('./sandbox.js')
    }
  },
  dropSelection: function(){
    this.satellite.clients.dropSelection();
  }
});
