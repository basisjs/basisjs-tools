(module.exports = function(flow){
  // solution for basis.js prior 1.0

  // var fconsole = flow.console;

  // var cultureDictionaries = flow.l10n.cultureDictionaries;
  // var packages = [];

  // // make culture packs
  // fconsole.start('Make packages');
  // for (var culture in cultureDictionaries)
  // {
  //   fconsole.log(culture + ' add to resource map - OK');

  //   packages.push(flow.files.add({
  //     jsRef: 'l10n/' + culture + '.json',
  //     type: 'json',
  //     isResource: true,
  //     jsResourceContent: cultureDictionaries[culture]
  //   }));
  // }

  // flow.l10n.packages = packages;

}).handlerName = '[l10n] Make packages';

module.exports.skip = function(flow){
  if (!flow.l10n)
    return 'basis.l10n not found';

  if (flow.l10n.version != 1)
    return 'Step is not supported for new version of basis.l10n';
};
