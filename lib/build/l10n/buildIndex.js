var at = require('../../ast').js;

(module.exports = function(flow){
  if (!flow.l10n.module)
  {
    flow.console.log('Skiped.')
    flow.console.log('basis.l10n not found');
    return;
  }

  var fconsole = flow.console;
  var keys = Object.keys(flow.l10n.keys).sort();

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

  //
  // add index to flow
  //
  flow.l10n.index = {
    map: map,
    keys: pathIndex,
    content: res.join('')
  };


  //
  // process templates & pack l10n pathes
  //
  fconsole.start('Fix index keys in templates');
  flow.l10n.tmplRefs.forEach(function(entry){
    if (entry.key.charAt(0) == '#')
    {
      var path = basis.l10n.token(entry.key).dictionary.name + '.' + basis.l10n.token(entry.key).name;
      if (pathIndex.hasOwnProperty(path))
      {
        entry.key = '#' + pathIndex[path].toString(36);
        entry.host[entry.idx] = 'l10n:' + entry.key;
        fconsole.log('l10n:' + entry.key + ' -> ' + 'l10n:' + entry.key);
      }
      else
        flow.warn({
          file: entry.file.relpath,
          message: 'l10n:' + entry.key + ' is not resolved by index'
        });
    }
  });
  fconsole.endl();  

  //
  // add index to resources
  //
  fconsole.log('# Add index into resource map');
  var indexResource = flow.files.add({
    jsRef: '_l10nIndex_',
    type: 'text',
    isResource: true,
    jsResourceContent: flow.l10n.index.content
  });


  //
  // inject index initialization
  //
  fconsole.log('# Inject index init into basis.l10n');

  flow.l10n.module.link(indexResource);

  at.append(flow.l10n.module.ast, at.parse('(' + function(){
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

  fconsole.log('OK');
}).handlerName = '[l10n] Build index';
