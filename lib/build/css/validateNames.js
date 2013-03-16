(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = flow.css.idMap;
  var classMap = flow.css.classMap;

  if (!flow.options.cssCutUnused)
  {
    fconsole.log('Not required (using for --css-cut-unused)')
    return;
  }

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

      // mark as unused
      list.unused = true;
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

      // mark as unused
      list.unused = true;
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
