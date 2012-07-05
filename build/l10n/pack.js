
var at = require('../js/ast_tools');

module.exports = function(flowData){
  var fconsole = flowData.console;

  if (flowData.options.l10nPack)
  {
    var l10nIndex = flowData.l10n.index;

    if (!l10nIndex)
      throw 'l10n index must be build first';

    // pack definitions
    fconsole.log('Pack definitions');
    fconsole.incDeep();
    flowData.l10n.defList.forEach(function(entry){
      fconsole.log(entry.name);

      var dict = {};
      dict[entry.name] = entry.keys;

      entry.args[2] = ['array', packDictionary(dict, l10nIndex.map).map(function(token){
        return [typeof token == 'number' ? 'num' : 'string', token];
      })];
    });
    fconsole.decDeep();
    fconsole.log();

    // pack packages
    fconsole.log('Pack packages');
    fconsole.incDeep();
    flowData.l10n.packages.forEach(function(file){
      fconsole.log(file.jsRef);
      file.jsResourceContent = packDictionary(file.jsResourceContent, l10nIndex.map);
    });
    fconsole.decDeep();
    fconsole.log();

    // add index to resources
    fconsole.log('# Add index into resource map');
    flowData.files.add({
      jsRef: '_l10nIndex_',
      type: 'text',
      isResource: true,
      jsResourceContent: l10nIndex.content
    });

    // if l10n module exists, inject index initialization
    fconsole.log('# Inject index init into basis.l10n');
    if (flowData.l10n.module)
    {
      at.append(flowData.l10n.module.ast, at.parse('(' + function(){
        var parts = basis.resource('_l10nIndex_').fetch().split(/([\<\>\#])/);
        var stack = [];
        for (var i = 0; i < parts.length; i++)
        {
          switch(parts[i])
          {
            case '#': stack.length = 0; break;
            case '<': stack.pop(); break;
            case '>': break;
            default:
              if (parts[i])
              {
                stack.push(parts[i]);
                getToken(stack.join('.'));
              }
          }
        }
      } + ')()'));
    }
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Use option --l10n-pack for compression');
  }
}

module.exports.handlerName = '[l10n] Compress';

//
// tools
//

function packDictionary(dict, map){
  var result = [];
  var flattenDict = {};

  // linear
  for (var dictName in dict){
    for (var key in dict[dictName]){
      flattenDict[dictName + '.' + key] = dict[dictName][key];
    }
  }

  // pack
  for (var i = 0, gap = -1; i < map.length; i++)
  {
    if (flattenDict[map[i]])
    {
      if (gap != -1)
        result.push(gap);

      result.push(flattenDict[map[i]]);

      gap = -1;
    }
    else
      gap++;
  }

  if (typeof result[result.length - 1] == 'number')
    result.pop();

  return result;
}
