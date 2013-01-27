
var js_at = require('../js/ast_tools');
var path = require('path');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;
  var templateModule = flow.tmpl.module;

  if (!templateModule)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.template is not available');
    return;    
  }

  /*console.log(flow.js.globalScope.resolve(['dot', ['dot', ['name', 'basis'], 'template'], 'define']));
  console.log(flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'template']))
  process.exit();*/

  //
  // process themes
  //

  fconsole.start('Apply template defines');
  for (var themeName in flow.tmpl.themes)
  {
    fconsole.start('theme `' + themeName + '`');
    for (var key in flow.tmpl.themeResources[themeName])
    {
      var resource = flow.tmpl.themeResources[themeName][key];
      if (resource.resourceRef)
      {
        fconsole.log(key, '->', 'basis.resource(\'' + path.relative(flow.options.base, resource.resourceRef.filename) + '\')');
        basis.template.theme(themeName).define(key, basis.resource(resource.resourceRef.filename));
      }
      else
        console.warn(themeName, key, 'have no resourceRef');
    }
    fconsole.endl();
  }
  fconsole.endl();


  //
  // process templates
  //

  fconsole.start('Process templates');
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.start(file.relpath);

      var decl = basis.template.makeDeclaration(file.content, file.baseURI, { classMap: false });

      file.decl = decl;
      file.ast = decl.tokens;

      /*if (decl.deps.length)
      {
        fconsole.start('deps:');
        fconsole.list(decl.deps);
        fconsole.end();
      }*/

      for (var j = 0, resourceFilename; resourceFilename = decl.resources[j]; j++)
      {
        var resFile = flow.files.add({
          filename: resourceFilename // resource filename already resolved, and should be absolute
        });
        
        file.link(resFile);
        resFile.isResource = true;
      }

      fconsole.endl();
    }
  }
  fconsole.endl();

  //process.exit();
}

module.exports.handlerName = '[tmpl] Extract';
