var csso = require('csso');

(module.exports = function(flow){
  var fconsole = flow.console;

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
        [{}, 'stylesheet', [{}, 'ruleset', [{}, 'selector', [{}, 'simpleselector', [{}, 'ident', 'rule']]],
          file.ast
        ]])[2][3];
    }
  fconsole.end();
}).handlerName = '[css] Compress';

module.exports.skip = function(flow){
  if (!flow.options.cssPack)
    return 'Use option --css-pack for compression';
};
