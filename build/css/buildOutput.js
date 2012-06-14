
var path = require('path');
var fs = require('fs');
var csso = require('csso');
var relpath_;

//
// export handler
//

module.exports = function(flowData){
  var outputFiles = flowData.css.outputFiles;

  relpath_ = flowData.files.relpath;

  // process files in reverse order
  for (var i = outputFiles.length - 1, file; file = outputFiles[i]; i--)
  {
    flowData.console.log(file.outputFilename);
    flowData.console.incDeep();
    buildFile(file, flowData);
    flowData.console.decDeep();
  }
}
module.exports.handlerName = 'Build css files';

//
// main part
//

function relpath(file){
  return relpath_(file.filename);
}

function packCommentToken(comment){
  return [{}, 'comment', comment.replace(/\*\//g, '* /')];
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
        packCommentToken(' [WARN] Recursion: ' + context.map(relpath).join(' -> ') + ' -> ' + relpath(file) + ' '),
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
      packCommentToken(' ' + msg + ' '),
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
      packCommentToken(importToken.code),
      [{}, 's', '\n\n']
    );
    importToken.token.splice.apply(importToken.token, injection);
  }

  context.pop();

  return file.ast;
}
