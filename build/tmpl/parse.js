
var path = require('path')

global.document = require('jsdom-nocontextifiy').jsdom();
global.basis = require('../../build.test/basis/src/basis.js').basis;
basis.require('basis.template');

module.exports = function(flowData){

  var queue = flowData.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
      processTemplate(file, flowData);
  }
}

function processTemplate(file, flowData){
  var baseURI = path.dirname(file.filename);
  var decl = basis.template.makeDeclaration(file.content, baseURI + '/', { classMap: false });

  //if (cssOptimazeNames && decl.unpredictable)
  //  treeConsole.log('  [WARN] Unpredictable class names in template, class names optimization is not safe\n');

  if (decl.resources.length)
  {
    //treeConsole.incDeep();
    for (var i = 0, res, ext; res = decl.resources[i]; i++)
    {
      res = path.resolve(baseURI, res);
      ext = path.extname(res);
      if (ext == '.css')
      {
        flowData.files.add({
          source: 'tmpl:resource',
          filename: res
        });
        //treeConsole.log('[+] ' + relpath(res));
      }
      else
      {
        //treeConsole.log('[!] ' + relpath(res) + ' (unknown type ignored)');
      }
    }
    //treeConsole.log();
    //treeConsole.decDeep();
  }

  file.tmplTokens = decl.tokens;
  //resource.content = decl.toString();

  if (decl.classMap)
    file.classMap = decl.classMap;
}