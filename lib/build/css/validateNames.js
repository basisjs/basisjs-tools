(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = flow.css.idMap;
  var classMap = flow.css.classMap;
  var warnCount = 0;

  //
  // warnings
  //

  var warnNoStyle = [];
  var warnNoHtml = [];
  for (var name in classMap)
  {
    var list = classMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      warnNoStyle.push('class: ' + name);

    if (!inHtml && inCss)
    {
      warnNoHtml.push('class: ' + name);

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
      warnNoStyle.push('id: ' + name);

    if (!inHtml && inCss)
    {
      warnNoHtml.push('id: ' + name);

      if (flow.options.cssCutUnused)
        for (var i = 0, item; item = list[i]; i++)
          if (item.type == 'style-id')
            deleteSelector(item.token);
    }
  }

  if (warnNoHtml.length)
  {
    fconsole.log('[!] Never used in html & templates');
    fconsole.list(warnNoHtml, ' ');
    fconsole.log();
  }

  if (warnNoStyle.length)
  {
    fconsole.log('[!] No styles for');
    fconsole.list(warnNoStyle, ' ');
    fconsole.log();
  }

  if (warnCount)
    fconsole.log('[WARN] ' + warnCount + ' problem(s) detected, name optimizing may breakdown app\n');

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
