
var fs = require('fs');
var at = require('../js/ast_tools');

module.exports = function(flowData){

  var fconsole = flowData.console;
  var cultureList = flowData.l10n.cultureList;

  var packages = flowData.l10n.packages;
  var baseMap = flowData.l10n.baseMap;
  var keyMap = flowData.l10n.keys;
  var pathes = flowData.l10n.pathes;

  // init packages

  var cultureContentMap = {};
  for (var i = 0; culture = cultureList[i]; i++)
    cultureContentMap[culture] = {};

  // check out pathes and collect culture content files

  fconsole.start('Collect culture content');

  for (var i = 0; culture = cultureList[i]; i++)
  {
    fconsole.start(culture);

    for (var path in pathes)
    {
      var cultureFile = path + '/' + culture + '.json';
      if (fs.existsSync(cultureFile))
      {
        var cultureMap = cultureContentMap[culture];
        fconsole.start('[+] ' + cultureFile);
        try {
          var dictPack = JSON.parse(fs.readFileSync(cultureFile, 'utf-8'));
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
          fconsole.log('[!] Can\'t parse ' + cultureFile, e);
        }
        fconsole.decDeep();
      }
    }

    fconsole.endl();
  }
  fconsole.endl();

  // make culture packs
  fconsole.start('Make packages');
  for (var culture in cultureContentMap)
  {
    fconsole.log(culture);

    packages.push(flowData.files.add({
      jsRef: 'l10n/' + culture + '.json',
      type: 'json',
      isResource: true,
      jsResourceContent: cultureContentMap[culture]
    }));

    fconsole.log('  [OK] Add to resource map');
  }
}

module.exports.handlerName = '[l10n] Make packages';
