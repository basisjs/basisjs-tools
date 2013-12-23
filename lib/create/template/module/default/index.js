{!!l10n}basis.require('basis.l10n');
basis.require('basis.ui');

{!!l10n}//var dict = basis.l10n.dictionary(__filename);

module.exports = new basis.ui.Node({
  template: resource('template/view.tmpl'),
  binding: {
  },
  action: {
  }
});