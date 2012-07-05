
var fs = require('fs');
var at = require('../js/ast_tools');

module.exports = function(flowData){

  var fconsole = flowData.console;
  var cultureList = flowData.l10n.cultureList;

  var dictMap = flowData.l10n.dictMap;
  var keyMap = flowData.l10n.keys;
  var pathes = flowData.l10n.pathes;

  // init packages

  var cultureContentMap = {};
  for (var i = 0; culture = cultureList[i]; i++)
    cultureContentMap[culture] = {};

  // check out pathes and collect culture content files

  fconsole.log('Collect culture content');
  fconsole.incDeep();

  for (var i = 0; culture = cultureList[i]; i++)
  {
    fconsole.log(culture);
    fconsole.incDeep();

    for (var path in pathes)
    {
      var cultureFile = path + '/' + culture + '.json';
      if (fs.existsSync(cultureFile))
      {
        var cultureMap = cultureContentMap[culture];
        fconsole.log('[+] ' + cultureFile);
        fconsole.incDeep();
        try {
          var dictPack = JSON.parse(fs.readFileSync(cultureFile, 'utf-8'));
          for (var dictName in dictPack)
          {
            if (!dictMap[dictName])
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

    fconsole.decDeep();
    fconsole.log();
  }
  fconsole.decDeep();
  fconsole.log();

  // make culture packs
  fconsole.log('Make packages');
  fconsole.incDeep();
  for (var culture in cultureContentMap)
  {
    fconsole.log(culture);

    var jsRef = 'l10n/' + culture + '.json';
    var content = cultureContentMap[culture];

    if (false)
    {
      content = flowData.l10n.packDictionary(content);
      fconsole.log('  [OK] Pack');
    }

    flowData.files.add({
      jsRef: jsRef,
      type: 'json',
      isResource: true,
      jsResourceContent: content
    });

    fconsole.log('  [OK] Add to resource map');
  }
}

module.exports.handlerName = '[l10n] Make packages';
