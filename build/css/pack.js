
var csso = require('csso');

module.exports = function(flowData){
  if (flowData.options.cssPack)
  {
    flowData.css.outputFiles.forEach(function(file){
      console.log('Pack ' + file.outputFilename);
      file.ast = csso.compress(file.ast);
    });
  }
  else
    console.log('Skiped.\nUse option --css-pack for CSS compression');
}

module.exports.handlerName = 'Compress CSS';