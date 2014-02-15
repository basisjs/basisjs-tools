(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = flow.css.idMap;
  var classMap = flow.css.classMap;

  if (!flow.options.cssCutUnused)
  {
    fconsole.log('Skiped.');
    fconsole.log('Use --css-cut-unused option');
    return;
  }

  for (var name in classMap)
  {
    var list = classMap[name];

    if (list.unused)
    {
      console.log('Cut selectors contains .' + name);
      for (var i = 0, item; item = list[i]; i++)
        if (item.type == 'style-class')
          deleteSelector(item.token);
    }
  }

  for (var name in idMap)
  {
    var list = idMap[name];

    if (list.unused)
    {
      console.log('Cut selectors contains #' + name);
      for (var i = 0, item; item = list[i]; i++)
        if (item.type == 'style-id')
          deleteSelector(item.token);
    }
  }

}).handlerName = '[css] Cut unused selectors';

function deleteSelector(token){
  var simpleselector = token.stack[0];
  var selector = token.stack[1];
  var rule = token.stack[2];
  var stylesheet = token.stack[3];
  var idx;

  idx = selector.indexOf(simpleselector);
  if (idx != -1)
  {
    // delete simple selector from selector
    selector.splice(idx > 2 ? idx - 1 : idx, 2);
  }

  // if no more simple selectors
  if (selector.length == 2)
  {
    idx = stylesheet.indexOf(rule);
    if (idx != -1)
    {
      // delete rule from stylesheet
      stylesheet.splice(idx, 1);
      if (stylesheet[idx] && stylesheet[idx][1] == 's')
        stylesheet.splice(idx, 1);
    }
  }
}
