/* eslint-env browser */
/* global resource */

var Node = require('basis.ui').Node;
var Value = require('basis.data').Value;
var router = require('basis.router');
var Client = require('../type.js').Client;

var selected = new Value();
var pickMode = new Value({ value: false });
var selectedClient = selected.as(Client.getSlot);
var selectedOnline = selectedClient.query('data.online');

Value
  .from(router.route('*id').param('id'))
  .link(selected, selected.set);

selected.link(location, function(value){
  this.hash = value || '';
});

module.exports = new Node({
  active: true,
  dataSource: Client.all,

  template: resource('./template/list.tmpl'),
  binding: {
    selectedOnline: selectedOnline
  },

  childClass: {
    template: resource('./template/client.tmpl'),
    binding: {
      title: {
        events: 'update',
        getter: function(node){
          return node.data.title || '<no title>';
        }
      },
      location: 'data:',
      online: 'data:',
      num: 'data:',
      pickMode: pickMode,
      selected: selected.compute('update', function(node, selected){
        return node.data.id == selected;
      })
    },
    action: {
      select: function(){
        if (!this.isDisabled())
          selected.set(this.data.id);
      }
    }
  },

  pickMode: pickMode,
  selectedId: selected,
  selectedClient: selectedClient,
  dropSelection: function(){
    selected.set(null);
  }
});
