var jsAt = require('../../ast').js;

(module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  //
  // check options and required modules
  //

  if (!flow.options.tmplPregenerate)
  {
    fconsole.log('Skiped.');
    fconsole.log('Use --tmpl-pregenerate flag to pregenerate template functions.');
    return;
  }

  if (!flow.tmpl.module)
  {
    fconsole.log('Skiped.');
    fconsole.log('basis.template is not available');
    return;
  }

  if (!flow.tmpl.fgen)
  {
    fconsole.log('Skiped.');
    fconsole.log('basis.template.htmlfgen is not available');
    return;
  }


  //
  // fetch neccessary modules and generate template functions
  //

  basis.require('basis.template');
  basis.require('basis.template.htmlfgen');

  var fnMap = [];
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'template')
    {
      fconsole.log(file.relpath, '->', file.jsRef);

      // generate functions
      var fn = basis.template.htmlfgen.getFunctions(file.ast);

      // convert to string
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

      // add to function map
      fnMap.push('"' + file.jsRef + '":{' + fnRes.join(',') + '}');

      /*console.log(fn);
      console.log(fn.createInstance.toString());
      console.log('\n\n' + JSON.stringify(fnMap));*/
    }


  //
  // inject generated functions into module code
  //

  fconsole.log('# Append pregenerated function map to basis.template.htmlfgen');
  jsAt.append(flow.tmpl.fgen.ast, jsAt.parse(';tmplFunctions={' + fnMap.join(',') + '};'));

}).handlerName = '[tmpl] Pregenerate functions';
