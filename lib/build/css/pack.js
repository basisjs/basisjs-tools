var csso = require('csso');
var copyAst = require('../../ast/css/').copy;

(module.exports = function(flow){
  var fconsole = flow.console;

  fconsole.start('Process packages');
  flow.css.packages.forEach(function(file){
    fconsole.log(file.relOutputFilename);
    // make a copy of ast, as it could has shared parts
    // and csso optimizer might corrupt those parts
    file.ast = csso.compress(copyAst(file.ast));
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
