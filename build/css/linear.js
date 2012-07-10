
var at = require('./ast_tools');
var relpath_;

//
// export handler
//

module.exports = function(flowData){
  var packages = flowData.css.packages;
  var fconsole = flowData.console;

  relpath_ = flowData.files.relpath;

  // process files in reverse order
  for (var i = packages.length - 1, file; file = packages[i]; i--)
  {
    fconsole.start(file.relOutputFilename);

    buildFile(file, flowData);

    fconsole.endl();
  }
}
module.exports.handlerName = '[css] Linear files';

//
// main part
//

function relpath(file){
  return relpath_(file.filename);
}

function buildFile(file, flowData, context){
  if (!context)
    context = [];
  else
  {
    if (context.indexOf(file) != -1)
    {
      flowData.console.log('# [WARN] Recursion ' + context.map(relpath).join(' -> ') + ' -> ' + relpath(file));
      return [
        {}, 'stylesheet',
        [{}, 's', ''],
        at.packComment(' [WARN] Recursion: ' + context.map(relpath).join(' -> ') + ' -> ' + relpath(file) + ' '),
        [{}, 's', '\n\n']
      ];
    }
  }

  if (file.used)
  {
    var msg = '[DUP] ' + (file.filename ? flowData.files.relpath(file.filename) : '[inline style]') + ' ignored as already used';
    flowData.console.log('# ' + msg);
    return [
      {}, 'stylesheet',
      [{}, 's', ''],
      at.packComment(' ' + msg + ' '),
      [{}, 's', '\n\n']
    ];
  }

  file.used = true;

  context.push(file);

  for (var i = file.imports.length - 1, importToken; importToken = file.imports[i]; i--)
  {
    var injection = buildFile(importToken.file, flowData, context).slice(2);

    if (importToken.media.length)
    {
      injection.unshift([{}, 's', '\n']);
      injection.push([{}, 's', '\n']);
      injection = [
        [{}, 'atruler',
          [{}, 'atkeyword',
            [{}, 'ident', 'media' ]
          ],
          [{}, 'atrulerq'].concat(importToken.media),
          [{}, 'atrulers'].concat(injection)
        ]
      ];
    }

    // inject
    injection.unshift(importToken.pos, 1,
      at.packComment(importToken.code),
      [{}, 's', '\n\n']
    );
    importToken.token.splice.apply(importToken.token, injection);
  }

  context.pop();

  return file.ast;
}
