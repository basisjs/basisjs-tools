
var utils = require('../misc/utils');
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

function processFile(file, flow){
  var fconsole = flow.console;

  // import tokens
  file.imports = [];

  // parse css into tree
  file.ast = at.parse(file.content, file.rule);

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

        // resolve media
        var media = parts;
        if (media[0] && media[0][1] != 's')
          media.unshift(at.packWhiteSpace(' '));

        // add link
        file.link(importFile);

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