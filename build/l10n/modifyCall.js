module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? flowData.files.relpath(file.filename) : '[inline script]');
      fconsole.incDeep();

      process(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
  }
};

var processor = require("uglify-js").uglify;
var astUtils = require('../misc/js-ast-utils');
var path = require('path');
var util = require('util');


function createDictionaryKeyMap(keys){
  keys = keys.sort();

  var stack = [];
  var res = [];
  var map = [];
  var pathMap = {};
  var keyIndex = 0;
  for (var i = 0, key; key = keys[i]; i++)
  {
    var parts = key.split('.');
    var reset = false;
    var offset = 0;

    if (stack.length && stack[0] != parts[0])
    {
      res.push('#');
      stack = [];
    }

    if (!stack.length)
      reset = true;
    else
    {
      for (; offset < parts.length; offset++){
        if (parts[offset] != stack[offset])
        {
          if (stack[offset])
          {
            reset = true;
            res.push(new Array(stack.length - offset + 1).join('<'));
            stack.splice(offset);
          }
          break;
        }
      }
    }

    while (parts[offset])
    {
      if (!reset)
        res.push('>');

      reset = false;
      res.push(parts[offset]);
      stack.push(parts[offset]);
      offset++;

      var path = stack.join('.');
      map.push(path);
    }

  }

  return {
    map: map,
    content: res.join('')
  };
}

function packDictionary(dict, map){
  var linear = {};
  var result = [];

  for (var dictName in dict){
    for (var key in dict[dictName]){
      linear[dictName + '.' + key] = dict[dictName][key];
    }
  }

  for (var i = 0, gap = -1; i < map.length; i++)
  {
    if (linear[map[i]])
    {
      if (gap != -1)
        result.push(gap);

      result.push(linear[map[i]]);

      gap = -1;
    }
    else
      gap++;
  }

  if (typeof result[result.length - 1] == 'number')
    result.pop();

  return result;
}

function process(file, flowData){
  var ast = file.ast;
  var context = {
    __filename: file.filename || '',
    __dirname: file.filename ? path.dirname(file.filename) + '/' : ''
  };
  var dictInfo = {
    dictList: flowData.dictList,
    l10nKeys: flowData.l10nKeys
  };

  var walker = processor.ast_walker();
  var dictionaryKeyMap = createDictionaryKeyMap(dictInfo.l10nKeys);

  file.ast = walker.with_walkers({
    call: function(expr, args){
      if (astUtils.isAstEqualsCode(expr, 'basis.l10n.createDictionary'))
      {
        var newArgs = astUtils.getCallArgs(args, context);
        var id = newArgs[0];
        var tokens = newArgs[2];
        var dict = {};
        dict[id] = tokens;
        var newTokens = packDictionary(dict, dictionaryKeyMap.map);
        newArgs[0] = ['string', id];
        newArgs[1] = ['string', ''];
        newArgs[2] = ['array', newTokens.map(function(token){ return ['string', String(token)]; })];
        return [ this[0], walker.walk(expr), processor.MAP(newArgs, walker.walk) ];
      }
    }
  }, function(){
    return walker.walk(ast);
  });

}