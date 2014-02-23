var csso = require('csso');

module.exports = function(flow){
  var fconsole = flow.console;

  if (flow.options.cssPack)
  {
    fconsole.start('Process packages');
    flow.css.packages.forEach(function(file){
      fconsole.log(file.relOutputFilename);
      file.ast = csso.compress(file.ast);
    });
    fconsole.endl();

    fconsole.start('Process style attributes');
    for (var i = 0, file; file = flow.files.queue[i]; i++)
      if (file.type == 'style-block')
      {
        fconsole.log(file.relpath);
        file.ast = csso.compress(
          [{}, 'stylesheet', [{}, 'ruleset', [{}, 'selector', [{}, 'simpleselector', [{}, 'ident', 'a']]],
            file.ast
          ]])[2][3];
      }
    fconsole.end();
  }
  else
  {
    fconsole.log('Skiped.');
    fconsole.log('Use option --css-pack for compression');
  }
};

module.exports.handlerName = '[css] Compress';
