
module.exports = function(flowData){
  global.document = require('jsdom-nocontextifiy').jsdom();
  global.basis = require(flowData.js.basisScript).basis;
  basis.require('basis.template');

  var queue = flowData.files.queue;
  var fconsole = flowData.console;

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
          flowData.files.add({
            filename: file.resolve(resourceFilename)
          }).isResource = true;
        }
      }

      fconsole.endl();
    }
  }
}

module.exports.handlerName = '[tmpl] Extract';