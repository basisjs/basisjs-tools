
module.exports = function(flow){
  global.basis = require(flow.js.basisScript).basis;
  try {
    basis.require('basis.template');
  } catch(e) {
    global.document = require('jsdom-nocontextifiy').jsdom();
    basis.require('basis.template');
  }

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