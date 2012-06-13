
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
    buildFile(file);
}
module.exports.title = 'Build css files';

//
// main part
//

function relpath(file){
  return relpath_(file.filename);
}

function packCommentToken(comment){
  return [{}, 'comment', comment.replace(/\*\//g, '* /')];
}

function buildFile(file, context){
  if (!context)
    context = [];
  else
  {
    if (context.indexOf(file) != -1)
    {
      console.log('# [WARN] Recursion ' + context.map(relpath).join(' -> ') + ' -> ' + relpath(file));
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
    console.log('# [WARN] Duplicate -> ignored ');
    return [
      {}, 'stylesheet',
      [{}, 's', ''],
      packCommentToken(' [WARN] Duplicate -> ignored '),
      [{}, 's', '\n\n']
    ];
  }

  file.used = true;

  context.push(file);

  for (var i = file.imports.length - 1, importToken; importToken = file.imports[i]; i--)
  {
    console.log('>>', file.filename, importToken.code);
    var injection = buildFile(importToken.file, context).slice(2);

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
