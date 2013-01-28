
{!!l10n}  basis.require('basis.l10n');
  basis.require('basis.app');
  basis.require('basis.ui');

{!!l10n}  basis.l10n.createDictionary('{=name}', __dirname + '{=name}/l10n', {
{!!l10n}    title: '{=appTitle}',
{!!l10n}  	greeting: 'Hello world!'
{!!l10n}  });

  module.exports = basis.app({
  	title: basis.l10n.getToken('{=name}.title'),

{!!l10n}    l10n: {
{!!l10n}  	  default: 'ru-RU',
{!!l10n}  	  langs: ['en-US', 'ru-RU']
{!!l10n}    },
{!!l10n}
  	init: function(){
  		return new basis.ui.Node({
  			template: resource('{=name}/template/layout.tmpl')
  		}).element;
  	}
  });