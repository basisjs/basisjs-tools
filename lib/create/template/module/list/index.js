{!!l10n}basis.require('basis.l10n');
basis.require('basis.ui');
{!!type}basis.require('{=appName}.type');

{!!l10n}//var dict = basis.l10n.dictionary(__filename);

module.exports = new basis.ui.Node({
{!!type}  dataSource: {=appName}.type.{=type}.all,
{!!type}  active: true,
{!!type}
  template: resource('template/list.tmpl'),
  
  childClass: {
    template: resource('template/item.tmpl'),
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