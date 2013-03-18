(module.exports = function(flow){
  if (!flow.l10n.module)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.l10n not found');
    return;
  }

  var fconsole = flow.console;
  var packages = flow.l10n.packages;
  var cultureDictionaries = flow.l10n.cultureDictionaries;

  // make culture packs
  fconsole.start('Make packages');
  for (var culture in cultureDictionaries)
  {
    fconsole.log(culture);

    var file = flow.files.add({
      jsRef: 'l10n/' + culture + '.json',
      type: 'json',
      isResource: true,
      jsResourceContent: cultureDictionaries[culture]
    });

    packages.push(file);

    fconsole.log('  [OK] Add to resource map');
  }
}).handlerName = '[l10n] Make packages';
