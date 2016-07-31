var Node = require('basis.ui').Node;
var Value = require('basis.data').Value;
var Client = require('../type.js').Client;
var Expression = require('basis.data.value').Expression;

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

var autodp = persistentValue('acp-connection-auto-devpanel', false);
var selected = persistentValue('acp-connection-id');
var selectedClient = selected.as(Client.getSlot);
var selectedOnline = selectedClient.query('data.online');
var selectedDevpanel = selectedClient.query('data.devpanel');

module.exports = new Node({
  dataSource: Client.all,

  template: resource('./template/list.tmpl'),
  binding: {
    auto: autodp,
    selectedOnline: selectedOnline,
    curChannel: selectedClient.query('data.channels.pick()').as(function(value){
      return value && value.data.id;
    })
  },
  action: {
    updateAuto: function(event){
      autodp.set(!!event.target.checked);
    }
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
  handler: {
    childNodesModified: function(){
      if (!selected.value && this.firstChild)
        selected.set(this.firstChild.data.id);
    }
  }
});

new Expression(
  //selected,
  selectedOnline,
  selectedDevpanel,
  autodp,
  function(online, devpanel, auto){
    if (online && !devpanel && auto)
    {
      console.log('???');
    }
  }
);
