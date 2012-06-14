
var csso = require('csso');

module.exports = function(flowData){
  var fconsole = flowData.console;

  if (flowData.options.cssPack)
  {
    flowData.css.outputFiles.forEach(function(file){
      fconsole.log('Pack ' + flowData.files.relpath(file.outputFilename));
      file.ast = csso.compress(file.ast);
    });
  }
  else
    fconsole.log('Skiped.\nUse option --css-pack for CSS compression');
}

module.exports.handlerName = 'Compress CSS files';