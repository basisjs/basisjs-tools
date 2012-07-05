
var fs = require('fs');

module.exports = function(flowData){

  var fconsole = flowData.console;
  var cultureList = flowData.l10n.cultureList;
  var list = flowData.l10n.defList;
  var dictMap = {};
  var l10nKeys = {};
  var pathes = {}

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

  var cultureContentMap = {};
  for (var i = 0; culture = cultureList[i]; i++)
    cultureContentMap[culture] = [];

  // ok, now check out pathes and collect culture files

  for (var i = 0; culture = cultureList[i]; i++)
  {
    fconsole.log('Process ' + culture);
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
          var dictChunk = flowData.l10n.linearDictionary(JSON.parse(fs.readFileSync(cultureFile, 'utf-8')));
          for (var key in dictChunk)
          {
            if (!l10nKeys[key])
              fconsole.log('[!] Unknown key ' + key + ' (ignored)');
            else
            {
              // TODO: check for duplicates
              cultureMap[key] = dictChunk[key];
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

  // build index
  fconsole.log('Build index');
  flowData.l10n.index = createDictionaryKeyMap(Object.keys(l10nKeys));

  fconsole.log('Add index into resource map');
  flowData.files.add({
    jsRef: 'l10nindex',
    type: 'text',
    isResource: true,
    jsResourceContent: flowData.l10n.index.content
  });

  fconsole.log('');

  // make culture packs
  fconsole.log('Make lang packages');
  fconsole.incDeep();
  for (var culture in cultureContentMap)
  {
    fconsole.log(culture);

    var jsRef = culture + '.json';
    var content = flowData.l10n.packDictionary(cultureContentMap[culture], true);

    fconsole.log('  [OK] Pack dictionary');

    flowData.files.add({
      jsRef: jsRef,
      type: 'json',
      isResource: true,
      jsResourceContent: content
    });

    fconsole.log('  [OK] Add to resource map');
  }
}

module.exports.handlerName = '[l10n] Make dictionary';

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
