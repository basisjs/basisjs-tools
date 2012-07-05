
module.exports = function(flowData){

  flowData.dictList = {};
  flowData.l10nKeys = [];

  flowData.l10n = {
    cultureList: [],
    defList: [],
    linearDictionary: linearDictionary,
    packDictionary: function(dict, isLinear){
      if (!flowData.l10n.index)
        throw 'l10n index is not built yet';

      return packDictionary(isLinear ? dict : linearDictionary(dict), flowData.l10n.index.map);
    }
  }
}

module.exports.handlerName = '[l10n] init';

function linearDictionary(dict){
  var result = {};

  for (var dictName in dict){
    for (var key in dict[dictName]){
      result[dictName + '.' + key] = dict[dictName][key];
    }
  }

  return result;
}

function packDictionary(dict, map){
  var result = [];

  for (var i = 0, gap = -1; i < map.length; i++)
  {
    if (dict[map[i]])
    {
      if (gap != -1)
        result.push(gap);

      result.push(dict[map[i]]);

      gap = -1;
    }
    else
      gap++;
  }

  if (typeof result[result.length - 1] == 'number')
    result.pop();

  return result;
}
