
var path = require('path')

global.document = require('jsdom-nocontextifiy').jsdom();

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  global.basis = require(flowData.js.basisScript).basis;
  basis.require('basis.template');

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.log(flowData.files.relpath(file.filename));
      fconsole.incDeep();
      processTemplate(file, flowData);
      fconsole.decDeep();
      fconsole.log();
    }
  }
}
module.exports.handlerName = 'Parse templates';

function processTemplate(file, flowData){
  var baseURI = path.dirname(file.filename);
  var decl = basis.template.makeDeclaration(file.content, baseURI + '/', { classMap: false });
  var fconsole = flowData.console;

  //if (cssOptimazeNames && decl.unpredictable)
  //  fconsole.log('  [WARN] Unpredictable class names in template, class names optimization is not safe\n');

  if (decl.resources.length)
  {
    for (var i = 0, resourceFilename, ext; resourceFilename = decl.resources[i]; i++)
    {
      resourceFilename = path.resolve(baseURI, resourceFilename);
      ext = path.extname(resourceFilename);
      if (ext == '.css')
      {
        flowData.files.add({
          source: 'tmpl:resource',
          generic: true,
          filename: resourceFilename,
          baseURI: path.dirname(resourceFilename)
        });
        //fconsole.log('[+] ' + flowData.files.relpath(resourceFilename));
      }
      else
      {
        fconsole.log('[!] ' + flowData.files.relpath(resourceFilename) + ' (unknown type ignored)');
      }
    }
  }

  file.ast = decl.tokens;
  //resource.content = decl.toString();

  if (decl.classMap)
    file.classMap = decl.classMap;
}