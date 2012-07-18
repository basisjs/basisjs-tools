
var path = require('path');

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
          if (path.extname(resourceFilename) == '.css')
          {
            flowData.files.add({
              source: 'tmpl:resource',
              filename: path.resolve(file.baseURI, resourceFilename)
            }).isResource = true;
          }
          else
          {
            fconsole.log('[!] ' + flowData.files.relpath(resourceFilename) + ' (unknown type ignored)');
          }
        }
      }

      fconsole.endl();
    }
  }
}

module.exports.handlerName = '[tmpl] Extract';