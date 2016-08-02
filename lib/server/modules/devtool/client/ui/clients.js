var Node = require('basis.ui').Node;
var Value = require('basis.data').Value;
var Client = require('../type.js').Client;
var transport = require('../transport.js');

var storage = global.sessionStorage || {};
function persistentValue(name, defValue){
  return new Value({
    value: storage[name] ? JSON.parse(storage[name]) : defValue,
    handler: {
      change: function(){
        storage[name] = JSON.stringify(this.value);
      }
    }
  });
};

var selected = persistentValue('devtool-connection-id');
var selectedClient = selected.as(Client.getSlot);
var selectedOnline = selectedClient.query('data.online');

transport.onClientSelect(function(clientId){
  selected.set(clientId);
});

module.exports = new Node({
  active: true,
  dataSource: Client.all,

  template: resource('./template/list.tmpl'),
  binding: {
    selectedOnline: selectedOnline,
    curChannel: selectedClient.query('data.channels.pick()').as(function(value){
      return value && value.data.id;
    })
  },

  childClass: {
    dataSource: Value.factory('update', 'data.channels'),
    template: resource('./template/client.tmpl'),
    binding: {
      title: 'data:',
      location: 'data:',
      online: 'data:',
      devpanel: 'data:',
      channels: 'data:',
      selected: selected.compute('update', function(node, selected){
        return node.data.id == selected;
      })
    },
    action: {
      select: function(){
        if (!this.isDisabled())
          selected.set(this.data.id);
      }
    },
    childClass: {
      template: resource('./template/channel.tmpl'),
      binding: {
        id: 'data:'
      }
    }
  },

  selectedClient: selectedClient,
  dropSelection: function(){
    selected.set(null);
  }
});
