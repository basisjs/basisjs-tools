
module.exports = function(flow){

  var fconsole = flow.console;
  var queue = flow.files.queue;
  var cultureList = flow.l10n.cultureList;

  var packages = flow.l10n.packages;
  var baseMap = flow.l10n.baseMap;
  var keyMap = flow.l10n.keys;
  var pathes = flow.l10n.pathes;

  // init packages

  var cultureContentMap = {};
  for (var i = 0; culture = cultureList[i]; i++)
    cultureContentMap[culture] = {};

  // check out pathes and collect culture content files

  fconsole.start('Collect culture content');
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'l10n')
    {
      var culture = file.culture;
      var cultureMap = cultureContentMap[culture];

      fconsole.start('(' + culture + ') ' + file.relpath);
      try {
        var dictPack = JSON.parse(file.content);

        for (var dictName in dictPack)
        {
          if (!baseMap[dictName])
          {
            fconsole.log('[!] Unknown dictionary (ignored):', dictName);
          }
          else
          {
            if (cultureMap[dictName])
              fconsole.log('[!] Dictionary ' + dictName + ' was declared before (maybe duplicate?)');
            else
              cultureMap[dictName] = {};

            var inputDict = dictPack[dictName];
            var outputDict = cultureMap[dictName];
            
            for (var inputKey in inputDict)
            {
              var fullpath = dictName + '.' + inputKey;

              if (!keyMap[fullpath])
              {
                fconsole.log('[!] Unknown key (ignored):', fullpath);
              }
              else
              {
                if (outputDict.hasOwnProperty(inputKey))
                  fconsole.log('[!] Duplicate key ' + inputKey + ' for ' + dictName + ' ignored');
                else
                  outputDict[inputKey] = inputDict[inputKey];
              }
            }
          }
        }
      } catch(e) {
        fconsole.log('[!] Can\'t parse ' + file.relpath, e);
      }
      fconsole.endl();
    }
  }
  fconsole.endl();

  // make culture packs
  fconsole.start('Make packages');
  for (var culture in cultureContentMap)
  {
    fconsole.log(culture);

    var file = flow.files.add({
      jsRef: 'l10n/' + culture + '.json',
      type: 'json',
      isResource: true,
      jsResourceContent: cultureContentMap[culture]
    });

    packages.push(file);

    fconsole.log('  [OK] Add to resource map');
  }
}

module.exports.handlerName = '[l10n] Make packages';
