(module.exports = function(flow){
  var fconsole = flow.console;

  if (!flow.l10n.module)
  {
    fconsole.log('Skiped.');
    fconsole.log('basis.l10n not found');
    return;
  }

  if (flow.l10n.version)
  {
    fconsole.log('Skipped.');
    fconsole.log('Step is not support for new version of basis.l10n');
    return;
  }

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

  //
  // update path to dictionaries
  //
  fconsole.start('Update path in createDictionary calls');
  flow.l10n.defList.forEach(function(entry){
    fconsole.log(entry.name);
    entry.args[1] = ['string', 'l10n'];
  });
  fconsole.endl();

}).handlerName = '[l10n] Make packages';
