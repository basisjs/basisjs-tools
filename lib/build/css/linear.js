
var at = require('../../ast').css;

//
// export handler
//

module.exports = function(flow){
  var packages = flow.css.packages;
  var fconsole = flow.console;

  // process files in reverse order
  for (var i = packages.length - 1, file; file = packages[i]; i--)
  {
    fconsole.start(file.relOutputFilename);

    buildFile(file, flow, file.theme);

    fconsole.endl();
  }
}

module.exports.handlerName = '[css] Linear files';

//
// main part
//

function relpath(file){
  return file.relPath;
}

function buildFile(file, flow, theme, context){
  if (!context)
    context = [];
  else
  {
    if (context.indexOf(file) != -1)
    {
      flow.console.log('# [WARN] Recursion ' + context.map(relpath).join(' -> ') + ' -> ' + file.relPath);
      return [
        {}, 'stylesheet',
        [{}, 's', ''],
        at.packComment(' [WARN] Recursion: ' + context.map(relpath).join(' -> ') + ' -> ' + file.relPath + ' '),
        [{}, 's', '\n\n']
      ];
    }
  }

  if (file.used && file.used[theme])
  {
    var msg = '[DUP] ' + (file.filename ? file.relpath : '[inline style]') + ' ignored as already used';
    flow.console.log('# ' + msg);
    return [
      {}, 'stylesheet',
      [{}, 's', ''],
      at.packComment(' ' + msg + ' '),
      [{}, 's', '\n\n']
    ];
  }

  if (!file.used)
    file.used = {};
  file.used[theme] = true;

  context.push(file);

  for (var i = file.imports.length - 1, importToken; importToken = file.imports[i]; i--)
  {
    var injection = buildFile(importToken.file, flow, theme, context).slice(2);

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
