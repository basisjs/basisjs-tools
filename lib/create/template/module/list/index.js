{!!l10n}basis.require('basis.l10n');
basis.require('basis.ui');
basis.require('{=appName}.type');

{!!l10n}basis.l10n.createDictionary('{=appName}.module.{=name}', __dirname + 'l10n', {
{!!l10n}});

module.exports = new basis.ui.Node({
  template: resource('template/list.tmpl'),
  
  childClass: {
    template: resource('template/item.tmpl'),
    binding: {
      title: 'data:'
    },
    action: {

    }
  }
});