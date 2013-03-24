{!!l10n}basis.require('basis.l10n');
basis.require('basis.ui');

{!!l10n}basis.l10n.createDictionary('{=appName}.module.{=name}', __dirname + 'l10n', {
{!!l10n}  // key: 'value'
{!!l10n}});

module.exports = new basis.ui.Node({
  template: resource('template/view.tmpl'),
  binding: {
  },
  action: {
  }
});