
var path = require('path')

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;
  //process.exit();

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.log(file.relpath);
      fconsole.incDeep();

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

      fconsole.decDeep();
      fconsole.log();
    }
  }
}
module.exports.handlerName = '[tmpl] Parse & expand';
