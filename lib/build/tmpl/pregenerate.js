
(module.exports = function(flow){
	var fconsole = flow.console;
	var queue = flow.files.queue;
  var templateModule = flow.l10n.module;

  if (!templateModule)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.template is not available');
    return;    
  }

  if (!flow.options.tmplPregenerate)
  {
  	fconsole.log('Skiped.')
    fconsole.log('Use --tmpl-pregenerate flag to pregenerate template functions.');
    return;
  }

  /*basis.require('basis.template.htmlfgen');

  for (var i = 0, file; file = queue[i]; i++)
  	if (file.type == 'template')
  	{
  		fconsole.log(file.relpath);
  		var fn = basis.template.htmlfgen.getFunctions(file.ast);
  		console.log(fn);
  		console.log(fn.createInstance.toString());
  		process.exit();
  	}*/

}).handlerName = '[tmpl] Pregenerate functions';