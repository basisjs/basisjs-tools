
module.exports = function(flow){
  global.document = require('jsdom-nocontextifiy').jsdom();
  global.basis = require(flow.js.basisScript).basis;
  basis.require('basis.template');

  var queue = flow.files.queue;
  var fconsole = flow.console;

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
          flow.files.add({
            filename: file.resolve(resourceFilename)
          }).isResource = true;
        }
      }

      fconsole.endl();
    }
  }
}

module.exports.handlerName = '[tmpl] Extract';