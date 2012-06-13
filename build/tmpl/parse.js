
var path = require('path')

global.document = require('jsdom-nocontextifiy').jsdom();
global.basis = require('../../build.test/basis/src/basis.js').basis;
basis.require('basis.template');

module.exports = function(flowData){
  var queue = flowData.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      console.log('process template:', file.filename);
      processTemplate(file, flowData);
    }
  }
}

function processTemplate(file, flowData){
  var baseURI = path.dirname(file.filename);
  var decl = basis.template.makeDeclaration(file.content, baseURI + '/', { classMap: false });
  var fconsole = flowData.console;

  //if (cssOptimazeNames && decl.unpredictable)
  //  fconsole.log('  [WARN] Unpredictable class names in template, class names optimization is not safe\n');

  if (decl.resources.length)
  {
    fconsole.incDeep();
    for (var i = 0, res, ext; res = decl.resources[i]; i++)
    {
      res = path.resolve(baseURI, res);
      ext = path.extname(res);
      if (ext == '.css')
      {
        flowData.files.add({
          source: 'tmpl:resource',
          owner: '__generic__',
          filename: res
        });
        fconsole.log('[+] ' + flowData.files.relpath(res));
      }
      else
      {
        fconsole.log('[!] ' + flowData.files.relpath(res) + ' (unknown type ignored)');
      }
    }
    fconsole.log();
    fconsole.decDeep();
  }

  file.tmplTokens = decl.tokens;
  //resource.content = decl.toString();

  if (decl.classMap)
    file.classMap = decl.classMap;
}