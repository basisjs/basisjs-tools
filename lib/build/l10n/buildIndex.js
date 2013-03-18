(module.exports = function(flow){
  if (!flow.l10n.module)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.l10n not found');
    return;
  }

  // build index
  flow.l10n.index = createDictionaryKeyMap(Object.keys(flow.l10n.keys));
  flow.console.log('OK');
}).handlerName = '[l10n] Build index';

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
