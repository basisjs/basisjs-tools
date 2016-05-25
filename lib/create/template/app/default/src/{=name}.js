var Node = require('basis.ui').Node;
{!!l10n}var dict = require('basis.l10n').dictionary(__filename);
{!!l10n}require('app.settings.l10n');
/** @cut */ require('basis.devpanel');

module.exports = require('basis.app').create({
{ !l10n}{!!appTitle}  title: '{=appTitle}',
{ !l10n}{!!appTitle}
{!!l10n}  title: dict.token('title'),
{!!l10n}
  init: function(){
    return new Node({
      template: resource('./{=name}/template/layout.tmpl'),
      binding: {
        //moduleName: resource('./module/moduleName/index.js')
      }
    });
  }
});
