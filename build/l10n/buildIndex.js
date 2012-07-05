
var fs = require('fs');
var at = require('../js/ast_tools');

module.exports = function(flowData){

  var fconsole = flowData.console;
  var cultureList = flowData.l10n.cultureList;
  var list = flowData.l10n.defList;

  var dictMap = {};
  var l10nKeys = {};
  var pathes = {};

  // collect all keys and dictionaries
  for (var i = 0, entry; entry = list[i]; i++)
  {
    var name = entry[0];
    var path = entry[1];
    var keys = entry[2];

    fconsole.log(name);
    fconsole.incDeep();

    if (dictMap[name])
      fconsole.log('[!] ' + name + ' already declared in ' + entry[3].relpath);

    pathes[path] = true;
    dictMap[name] = path;

    for (var key in keys)
    {
      if (l10nKeys[name + '.' + key])
        fconsole.log('[!] Duplicate key found: ' + name + '.' + key);

      l10nKeys[name + '.' + key] = true;
    }

    fconsole.decDeep();
  }
  fconsole.log();

  // extend l10n with info
  flowData.l10n.keys = l10nKeys;
  flowData.l10n.pathes = pathes;
  flowData.l10n.dictMap = dictMap;

  // build index
  fconsole.log('# Build index');
  flowData.l10n.index = createDictionaryKeyMap(Object.keys(l10nKeys));

  fconsole.log('# Add index into resource map');
  flowData.files.add({
    jsRef: '_l10nIndex_',
    type: 'text',
    isResource: true,
    jsResourceContent: flowData.l10n.index.content
  });

  // if l10n module exists, inject index initialization
  fconsole.log('# Inject index init into basis.l10n');
  if (flowData.l10n.module)
  {
    at.append(flowData.l10n.module.ast, at.parse('(' + function(){
      var parts = basis.resource("_l10nIndex_").fetch().split(/([\<\>\#])/);
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

module.exports.handlerName = '[l10n] Build index';

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
