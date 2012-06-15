
var path = require('path')
var csso = require('csso');
var at = require('./ast_tools');

var dataUriRx = /^\s*data:\s*text\/css\s*;/i;
var base64PrefixRx = /^\s*base64\s*,\s*/i;


//
// export
//

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
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
            var pos = 3;

            if (parts[0][1] == 's')
            {
              pos++;
              parts.shift();
            }

            var importFile;
            var url = parts[0][1] == 'uri'
              ? at.unpackUri(parts[0])
              : at.unpackString(parts[0][2]);

            if (dataUriRx.test(url))
            {
              var content = url.replace(dataUriRx, '');

              // decode from base64
              if (base64PrefixRx.test(content))
                content = new Buffer(content.replace(base64PrefixRx, ''), 'base64').toString('utf-8');

              importFile = flowData.files.add({
                source: 'css:import',
                type: 'style',
                filename: '__base64__',
                baseURI: baseURI,
                content: content
              });
            }
            else
            {
              var filename = path.resolve(baseURI, url);

              importFile = flowData.files.add({
                source: 'css:import',
                filename: filename,
                baseURI: path.dirname(filename)
              });
            }

            var media = parts.slice(1);
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
