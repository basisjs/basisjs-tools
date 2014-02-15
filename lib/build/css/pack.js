var csso = require('csso');

module.exports = function(flow){
  var fconsole = flow.console;

  if (flow.options.cssPack)
  {
    flow.css.packages.forEach(function(file){
      fconsole.log('Pack ' + file.relOutputFilename);
      file.ast = csso.compress(file.ast);
    });
  }
  else
  {
    fconsole.log('Skiped.');
    fconsole.log('Use option --css-pack for compression');
  }
};

module.exports.handlerName = '[css] Compress';
