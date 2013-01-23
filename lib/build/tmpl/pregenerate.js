
(module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;
  var templateModule = flow.tmpl.module;
  var fgenModule = flow.tmpl.fgen;

  if (!flow.options.tmplPregenerate)
  {
    fconsole.log('Skiped.')
    fconsole.log('Use --tmpl-pregenerate flag to pregenerate template functions.');
    return;
  }

  if (!fgenModule)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.template.htmlfgen is not available');
    return;    
  }

  if (!templateModule)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.template is not available');
    return;    
  }


  basis.require('basis.template');
  basis.require('basis.template.htmlfgen');

  var fnMap = [];
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'template')
    {
      fconsole.log(file.relpath, file.jsRef);

      var fn = basis.template.htmlfgen.getFunctions(file.ast);
      var fnRes = [];
      for (var key in fn)
      {
        if (typeof fn[key] == 'function')
          value = fn[key].toString();
        if (Array.isArray(fn[key]))
          value = JSON.stringify(fn[key]);
        if (value)
          fnRes.push('"' + key + '":' + value);
      }

      fnMap.push('"' + file.jsRef + '":{' + fnRes.join(',') + '}');

      /*console.log(fn);
      console.log(fn.createInstance.toString());
      console.log('\n\n' + JSON.stringify(fnMap));*/
    }

  fconsole.log('# Add pregenerated functions in basis.template.htmlfgen');
  var jsAt = require('../js/ast_tools');
  jsAt.append(fgenModule.ast, jsAt.parse(';tmplFunctions={' + fnMap.join(',') + '};'));

}).handlerName = '[tmpl] Pregenerate functions';