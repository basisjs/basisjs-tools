module.exports = function(flow){
  var fconsole = flow.console;
  var basisToken = flow.js.basis.l10n.token;
  var l10nIndex = flow.l10n.index;

  if (!l10nIndex)
  {
    flow.warn({
      fatal: true,
      message: 'l10n index must be built before compression'
    });
    return;
  }


  //
  // process templates & pack l10n pathes
  //
  fconsole.start('Relink token references in templates');
  flow.l10n.tmplRefs.forEach(function(entry){
    if (entry.key.charAt(0) == '#')
    {
      var path = basisToken(entry.key).dictionary.name + '.' + basisToken(entry.key).name;
      if (l10nIndex.keys.hasOwnProperty(path))
      {
        entry.key = '#' + l10nIndex.keys[path].toString(36);
        entry.host[entry.idx] = 'l10n:' + entry.key;
        fconsole.log('l10n:' + entry.key + ' -> ' + 'l10n:' + entry.key);
      }
      else
        flow.warn({
          file: entry.file.relpath,
          message: 'l10n:' + entry.key + ' is not resolved by index'
        });
    }
  });
  fconsole.endl();

  //
  // update path to dictionaries
  //
  fconsole.start('Update path in createDictionary calls');
  flow.l10n.defList.forEach(function(entry){
    fconsole.log(entry.name);
    entry.args[1] = ['string', 'l10n'];
  });
  fconsole.endl();
};
