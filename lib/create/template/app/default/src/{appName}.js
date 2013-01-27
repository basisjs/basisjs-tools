
{!!l10n}  basis.require('basis.l10n');
  basis.require('basis.app');
  basis.require('basis.ui');

{!!l10n}  basis.l10n.createDictionary('{appName}', __dirname + '{appName}/l10n', {
{!!l10n}    title: 'My app',
{!!l10n}  	greeting: 'Hello world!'
{!!l10n}  });

  module.exports = basis.app({
  	title: basis.l10n.getToken('{appName}.title'),

{!!l10n}    l10n: {
{!!l10n}  	  default: 'ru-RU',
{!!l10n}  	  langs: ['en-US', 'ru-RU']
{!!l10n}    },
{!!l10n}
  	init: function(){
  		return new basis.ui.Node({
  			template: resource('{appName}/template/layout.tmpl')
  		}).element;
  	}
  });