
var csso = require('csso');

module.exports = function(flowData){
  var fconsole = flowData.console;

  if (flowData.options.cssPack)
  {
    flowData.css.packages.forEach(function(file){
      fconsole.log('Pack ' + file.relOutputFilename);
      file.ast = csso.compress(file.ast);
    });
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Use option --css-pack for compression');
  }
}

module.exports.handlerName = '[css] Compress';