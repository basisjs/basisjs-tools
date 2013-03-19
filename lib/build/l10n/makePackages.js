(module.exports = function(flow){
  if (!flow.l10n.module)
  {
    flow.console.log('Skiped.')
    flow.console.log('basis.l10n not found');
    return;
  }

  var fconsole = flow.console;
  var cultureDictionaries = flow.l10n.cultureDictionaries;
  var packages = [];

  // make culture packs
  fconsole.start('Make packages');
  for (var culture in cultureDictionaries)
  {
    fconsole.log(culture + ' add to resource map - OK');

    packages.push(flow.files.add({
      jsRef: 'l10n/' + culture + '.json',
      type: 'json',
      isResource: true,
      jsResourceContent: cultureDictionaries[culture]
    }));
  }

  flow.l10n.packages = packages;

}).handlerName = '[l10n] Make packages';
