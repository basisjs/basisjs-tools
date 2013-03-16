
module.exports = function(flow){

  var fconsole = flow.console;
  var cultureList = flow.l10n.cultureList;
  var defList = flow.l10n.defList;

  var baseMap = {};
  var nameFile = {};
  var l10nKeys = {};

  // collect all dictionaries and keys
  fconsole.start('# Collect dictionaries and keys');
  for (var i = 0, entry; entry = defList[i]; i++)
  {
    var name = entry.name;
    var path = entry.path;
    var tokens = entry.keys;
    var file = entry.file;

    fconsole.start(name);

    if (baseMap[name])
    {
      flow.warn({
        file: file.relpath,
        message: name + ' already declared in ' + nameFile[name].relpath
      });
    }
    else
    {
      nameFile[name] = file;
      baseMap[name] = path;
    }

    for (var key in tokens)
    {
      if (l10nKeys[name + '.' + key])
      {
        flow.warn({
          file: file.relpath,
          message: 'Duplicate key found: ' + name + '.' + key
        });
      }

      l10nKeys[name + '.' + key] = true;
      baseMap[name][key] = tokens[key];
    }

    fconsole.end();
  }
  fconsole.endl();

  // extend l10n with info
  flow.l10n.keys = l10nKeys;
  flow.l10n.baseMap = baseMap;

  // build index
  fconsole.log('# Build index');
  flow.l10n.index = createDictionaryKeyMap(Object.keys(l10nKeys));
}

module.exports.handlerName = '[l10n] Build index';

function createDictionaryKeyMap(keys){
  keys = keys.sort();

  var stack = [];
  var res = [];
  var map = [];
  var pathIndex = {};
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
      pathIndex[path] = map.length;
      map.push(path);      
    }

  }

  return {
    map: map,
    keys: pathIndex,
    content: res.join('')
  };
}
