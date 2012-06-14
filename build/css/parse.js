
var path = require('path')
var csso = require('csso');

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
      fconsole.log('Parse ' + (file.filename || '[inline style]'));
      fconsole.incDeep();
      buildCssTree(file, flowData);
      fconsole.decDeep();
    }
  }
}
module.exports.handlerName = 'Parse & expand CSS'

//
// main part
//

function whitespaceAndComment(token){
  return token[1] != 's' && token[1] != 'comment';
}

function unpackStringToken(val){
  return val.substr(1, val.length - 2);
}

function unpackUriToken(token){
  var val = token.slice(2).filter(whitespaceAndComment)[0];

  if (val[1] == 'string')
    return unpackStringToken(val[2]);
  else
    return val[2];
}

function processCssTree(tree, file, flowData){

  function walkTree(topToken, offset){
    for (var i = offset || 0, token; token = topToken[i]; i++)
    {
      switch (token[1])
      { 
        case 'atrules':

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
              ? unpackUriToken(parts[0])
              : unpackStringToken(parts[0][2]);

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
              token: topToken,
              pos: i,
              code: csso.translate(csso.cleanInfo(token)),
              file: importFile,
              media: media.filter(whitespaceAndComment).length ? media : []
            });
          }

          break;

        default:

          walkTree(token, 2);

          break;
      }
    }
  }

  var baseURI = path.dirname(file.filename);

  // import tokens
  file.imports = [];

  // walk tokens
  walkTree([tree]);
}

function buildCssTree(file, flowData){
  // parse css into tree
  file.ast = csso.parse(file.content, 'stylesheet');

  // search and extract css files
  processCssTree(file.ast, file, flowData);
}
