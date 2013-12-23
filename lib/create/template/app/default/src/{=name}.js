{!!l10n}basis.require('basis.l10n');
{!!l10n}basis.require('app.settings.l10n');
basis.require('basis.app');
basis.require('basis.ui');
;;;basis.require('basis.devpanel');

{!!l10n}var dict = basis.l10n.dictionary(__filename);
{!!l10n}
module.exports = basis.app.create({
{ !l10n}{!!appTitle}  title: '{=appTitle}',
{ !l10n}{!!appTitle}
{!!l10n}  title: dict.token('title'),
{!!l10n}
  init: function(){
    return new basis.ui.Node({
      template: resource('{=name}/template/layout.tmpl'),
      binding: {
        //moduleName: resource('module/moduleName/index.js')
      }
    });
  }
});
