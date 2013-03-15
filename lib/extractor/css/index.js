var utils = require('../../build/misc/utils');
var at = require('../../ast').css;

module.exports = function(flow){

  var fconsole = flow.console;
  var queue = flow.files.queue;


  //
  // Search for styles files in html
  //

  fconsole.log('Prepare output files');
  var outputFiles = queue.filter(function(file){
    return file.type == 'style' && file.htmlNode && !file.rule;
  });


  //
  // Search for style in html
  //

  fconsole.start('Process styles');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.type == 'style')
    {
      fconsole.start(file.relpath);
      processFile(file, flow);
      fconsole.endl();
    }
  }
  fconsole.endl();


  //
  // Save result in flow
  //

  flow.css = {
    outputFiles: outputFiles
  };

};

module.exports.handlerName = '[css] Extract';


//
// Main part: file process
//

function dropThemes(file, stack){
  if (!stack)
    stack = [];
  if (stack.indexOf(file) == -1)
  {
    stack.push(file);

    for (var i = 0, refFile; refFile = file.linkTo[i]; i++)
      dropThemes(refFile, stack);

    file.themes = null;

    stack.pop();
  }
}

function processFile(file, flow){
  var fconsole = flow.console;

  // import tokens
  file.imports = [];

  // parse css into tree
  // parse
  try {
    file.ast = at.parse(file.content, file.rule);
  } catch(e) {
    file.ast = [{}, file.rule ? 'block' : 'stylesheet'];
    flow.warn({
      fatal: true,
      file: file.relpath,
      message: 'Parse error of ' + file.relpath + ':\n' + (e.message || e)
    });
  }

  // search and extract css files
  at.walk(file.ast, {
    'atrules': function(token, parentToken){
      // @import
      if (token[2][1] == 'atkeyword' && token[2][2][1] == 'ident' && token[2][2][2] == 'import')
      {
        var parts = token.slice(3);

        if (parts[0][1] == 's')
          parts.shift();

        var firstArg = parts.shift();
        var uri = utils.resolveUri(
          firstArg[1] == 'uri'
            ? at.unpackUri(firstArg)
            : at.unpackString(firstArg[2])
        );

        // ignore externals
        if (uri.url)
          return;

        // resolve import file
        var importFile = flow.files.add(
          uri.filename
            ? {
                filename: file.resolve(uri.filename)
              }
            : {
                type: 'style',
                baseURI: file.baseURI,
                content: uri.content
              }
        );

        // inherit themes, that's important for template theming
        if (file.themes)
        {
          if (importFile.themes)
            file.themes.forEach(function(themeName){
              this.add(themeName)
            }, importFile.themes);
          else
          {
            if (!importFile.noThemes)
              importFile.themes = file.themes.slice();
          }
        }
        else
        {
          // drop themes on file that refer file with no themes
          if (importFile.themes)
            dropThemes(importFile);
        }

        // resolve media
        var media = parts;
        if (media[0] && media[0][1] != 's')
          media.unshift(at.packWhiteSpace(' '));

        // add link
        file.link(importFile, token);

        // add import
        file.imports.push({
          token: parentToken,
          pos: parentToken.indexOf(token),
          code: at.translate(token),
          file: importFile,
          media: media.filter(at.wsFilter).length ? media : []
        });
      }
    }
  });
}
