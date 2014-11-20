var at = require('../../ast').js;

module.exports = function(flow){
  var fconsole = flow.console;
  var keys = Object.keys(flow.l10n.keys).sort();
  var stack = [];
  var res = [];
  var map = [];
  var pathIndex = {};
  var keyIndex = 0;

  fconsole.log('[i] basis.l10n version 1');

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
      switch (parts[i])
      {
        case '#':
          stack.length = 0;
          break;
        case '<':
          stack.pop();
          break;
        case '>':
          break;
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
};
