
module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  if (!flow.js.basisScript)  // TODO: check for basis.template, but not for basis.js
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.template is not available');
    return;    
  }

  var templateModule;
  for (var i = 0; i < queue.length; i++)
    if (queue[i].type == 'script' && queue[i].namespace == 'basis.template')
    {
      templateModule = queue[i];
      break;
    }

  if (!templateModule)  // TODO: check for basis.template, but not for basis.js
  {
    fconsole.log('Skiped.')
    fconsole.log('basis.template is not available');
    return;    
  }

  //
  // main part
  //

  global.basis = require(flow.js.basisScript).basis;

  if (templateModule.deps.length && templateModule.deps.some(function(file){ return file.namespace == 'basis.dom' }))
    global.document = require('jsdom-nocontextifiy').jsdom();

  basis.require('basis.template');

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.start(file.relpath);

      var decl = basis.template.makeDeclaration(file.content, file.baseURI, { classMap: false });

      file.decl = decl;
      file.ast = decl.tokens;

      if (decl.resources.length)
      {
        for (var j = 0, resourceFilename; resourceFilename = decl.resources[j]; j++)
        {
          var resFile = flow.files.add({
            filename: file.resolve(resourceFilename)
          });
          
          file.link(resFile);
          resFile.isResource = true;
        }
      }

      fconsole.endl();
    }
  }
}

module.exports.handlerName = '[tmpl] Extract';