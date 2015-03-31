var utils = require('../../build/misc/utils');
var at = require('../../ast').css;
//var parseTime = 0;

module.exports = function(flow){

  var fconsole = flow.console;
  var queue = flow.files.queue;


  //
  // Prepare output style file list
  //

  fconsole.log('Prepare output files');
  var outputFiles = queue.filter(function(file){
    return file.type == 'style' && file.htmlNode;
  });


  //
  // Process files
  //

  fconsole.start('Process files');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.type == 'style')
    {
      fconsole.start(file.relpath + ' (' + (file.themes ? file.themes.join(',') : 'all') + ')');
      processFile(file, flow);
      fconsole.endl();
    }
  }
  fconsole.endl();


  //
  // Process style attributes
  //

  fconsole.start('Process style attributes');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
    if (file.type == 'style-block')
    {
      fconsole.log(file.relpath);
      processFile(file, flow);
    }
  fconsole.endl();

  //
  // Save result in flow
  //

  flow.css = {
    outputFiles: outputFiles
  };
  
  //console.log('time:', parseTime/1e6)
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
  var filename = file.filename;

  // import tokens
  file.imports = [];
  file.classes = [];
  file.ids = [];

  // parse css into tree
  // parse
  try {
    //var tt = process.hrtime();
    file.ast = at.parse(file.content, file.rule);
    //var diff = process.hrtime(tt);
    //parseTime += diff[0] * 1e9 + diff[1]   
  } catch(e) {
    file.ast = [{}, file.rule ? 'block' : 'stylesheet'];
    flow.warn({
      fatal: true,
      file: file.relpath,
      message: 'CSS parse error of ' + file.relpath + ':\n' + (e.message || e)
    });
  }

  // search and extract css files
  at.walk(file.ast, {
    'shash': function(token, parent, stack){
      var entry = token;

      entry.stack = stack.slice(stack.length - 4).reverse();
      entry.loc = file.location(entry[0]);

      file.ids.push(entry);
    },
    'clazz': function(token, parent, stack){
      var entry = token[2];

      entry.stack = stack.slice(stack.length - 4).reverse();
      entry.loc = file.location(entry[0]);

      file.classes.push(entry);
    },
    'atrules': function(token, parent){
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
              this.add(themeName);
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
          token: parent,
          pos: parent.indexOf(token),
          code: at.translate(token),
          file: importFile,
          media: media.filter(at.wsFilter).length ? media : []
        });
      }
    }
  });
}
