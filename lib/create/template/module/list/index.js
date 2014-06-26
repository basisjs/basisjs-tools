var Node = require('basis.ui').Node;
{!!type}var types = require('{=appName}.type');

module.exports = new Node({
{!!type}  dataSource: types.{=type}.all,
{!!type}  active: true,
{!!type}
  template: resource('./template/list.tmpl'),
  
  childClass: {
    template: resource('./template/item.tmpl'),
    binding: {
      title: 'data:'
    }
  }{!type},
{ !type}
{ !type}  childNodes: basis.array.create(5, function(idx){
{ !type}    return {
{ !type}      data: {
{ !type}        title: 'item ' + idx
{ !type}      }
{ !type}    }
{ !type}  })
{!!type}
});
