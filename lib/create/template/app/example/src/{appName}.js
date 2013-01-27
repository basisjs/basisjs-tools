
  basis.require('basis.l10n');
  basis.require('basis.app');
  basis.require('basis.ui');

  basis.l10n.createDictionary('{appName}', __dirname + '{appName}/l10n', {
  	title: 'My app'
  });

  module.exports = basis.app({
  	title: basis.l10n.getToken('{appName}.title'),

    l10n: {
  	  default: 'ru-RU',
  	  langs: ['en-US', 'ru-RU']
    },

  	init: function(){
  		return new basis.ui.Node({
  			template: resource('{appName}/template/layout.tmpl'),
        binding: {
          exampleModule: resource('module/exampleModule/index.js').fetch()
        }
  		}).element;
  	}
  });