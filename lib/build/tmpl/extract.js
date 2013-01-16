
var js_at = require('../js/ast_tools');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  var templateModule;
  for (var i = 0, file; file = queue[i]; i++)
    if (queue[i].type == 'script' && file.namespace == 'basis.template')
    {
      templateModule = queue[i];
      break;
    }

  if (!flow.js.basisScript || !templateModule)
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.template is not available');
    return;    
  }

  /*var DEFINE = flow.js.globalScope.resolve(['dot', ['dot', ['name', 'basis'], 'template'], 'define']);
  console.log(DEFINE);
  console.log(flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'template']))
  process.exit();*/

  //
  // main part
  //

  global.basis = require(flow.js.basisScript).basis;

  // old basis need depends on basis.dom, to prevent evaluting error use jsdom-nocontextifiy
  // probably we should drop that support in future
  if (templateModule.deps.some(function(file){ return file.namespace == 'basis.dom' }))
    global.document = require('jsdom-nocontextifiy').jsdom();

  // include native 
  basis.require('basis.template');

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.start(file.relpath);

      var decl = basis.template.makeDeclaration(file.content, file.baseURI, { classMap: false });

      file.decl = decl;
      file.ast = decl.tokens;

      //fconsole.log('deps:');
      //fconsole.list(decl.deps);
      //for (var j = 0, resourceFilename; depFilename = decl.resources[j]; j++)

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

  //process.exit();
}

module.exports.handlerName = '[tmpl] Extract';