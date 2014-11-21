var jsAt = require('../../ast').js;

(module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  //
  // fetch neccessary modules and generate template functions
  //

  flow.js.basis.require('basis.template');
  flow.js.basis.require('basis.template.htmlfgen');

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

module.exports.skip = function(flow){
  if (!flow.options.tmplPregenerate)
    return 'Use --tmpl-pregenerate flag to pregenerate template functions.';

  if (!flow.tmpl.module)
    return 'basis.template is not available';

  if (!flow.tmpl.fgen)
    return 'basis.template.htmlfgen is not available';
};
