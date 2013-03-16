(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = flow.css.idMap;
  var classMap = flow.css.classMap;

  //
  // warnings
  //

  var warnNoStyle = {};
  var warnNoHtml = {};

  function add(map, file, value){
    if (!map[file.relpath])
      map[file.relpath] = [];
    map[file.relpath].add(value);
  }

  for (var name in classMap)
  {
    var list = classMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      list.forEach(function(entry){
        add(warnNoStyle, entry.file, '.' + name);
      });

    if (!inHtml && inCss)
    {
      list.forEach(function(entry){
        add(warnNoHtml, entry.file, '.' + name);
      });

      if (flow.options.cssCutUnused)
        for (var i = 0, item; item = list[i]; i++)
          if (item.type == 'style-class')
            deleteSelector(item.token);
    }
  }

  for (var name in idMap)
  {
    var list = idMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      list.forEach(function(entry){
        add(warnNoStyle, entry.file, '#' + name);
      });

    if (!inHtml && inCss)
    {
      list.forEach(function(entry){
        add(warnNoHtml, entry.file, '#' + name);
      });

      if (flow.options.cssCutUnused)
        for (var i = 0, item; item = list[i]; i++)
          if (item.type == 'style-id')
            deleteSelector(item.token);
    }
  }

  for (var fn in warnNoStyle)
    flow.warn({
      file: fn,
      message: 'No style rules for: ' + warnNoStyle[fn].join(', ')
    });

  for (var fn in warnNoHtml)
    flow.warn({
      file: fn,
      message: 'Never used in html or templates: ' + warnNoHtml[fn].join(', ')
    });

}).handlerName = '[css] Validate names';

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

  if (selector.length == 2)
  { // no more simple selectors
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
