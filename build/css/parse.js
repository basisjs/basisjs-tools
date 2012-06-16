
var path = require('path')
var csso = require('csso');
var at = require('./ast_tools');

//
// export
//

module.exports = function(flowData){
  var fconsole = flowData.console;

  for (var i = 0, file; file = flowData.files.queue[i]; i++)
  {
    if (file.type == 'style')
    {
      fconsole.log('Parse ' + file.relpath);
      fconsole.incDeep();

      //
      // Main part
      //

      var baseURI = path.dirname(file.filename);

      // import tokens
      file.imports = [];

      // parse css into tree
      file.ast = csso.parse(file.content, 'stylesheet');

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
            var uri = at.resolveUri(
              firstArg[1] == 'uri'
                ? at.unpackUri(firstArg)
                : at.unpackString(firstArg[2])
            );

            // ignore externals
            if (uri.url)
              return;

            // resolve import file
            var importFile = flowData.files.add(
              uri.filename
                ? {
                    source: 'css:import',
                    filename: path.resolve(baseURI, uri.filename)
                  }
                : {
                    source: 'css:import',
                    type: 'style',
                    baseURI: baseURI,
                    content: uri.content
                  }
            );

            // resolve media
            var media = parts;
            if (media[0] && media[0][1] != 's')
              media.unshift(at.packWhiteSpace(' '));

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

      fconsole.decDeep();
    }
  }
}
module.exports.handlerName = 'Parse & expand CSS'
