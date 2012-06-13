
var path = require('path')
var csso = require('csso');

var dataUriRx = /^\s*data:\s*text\/css\s*;/i;
var base64PrefixRx = /^\s*base64\s*,\s*/i;


//
// export
//

module.exports = function(flowData){

  var queue = flowData.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'style')
    {
      console.log('Style file', file.filename);
      buildCssTree(file, flowData);
    }
  }
}


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

function packStringToken(string){
  return [{}, 'string', '"' + string.replace(/\"/, '\\"') + '"'];
}

function packCommentToken(comment){
  return [{}, 'comment', comment.replace(/\*\//g, '* /')];
}

function packUriToken(uri, token){
  token = token || [{}, 'uri'];
  token[2] = uri.indexOf(')') != -1 ? packStringToken(uri) : [{}, 'raw', uri];
  return token;
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

            var url = parts[0][1] == 'uri'
              ? unpackUriToken(parts[0])
              : unpackStringToken(parts[0][2]);

            var media = parts.slice(1);

            if (dataUriRx.test(url))
            {
              var content = url.replace(dataUriRx, '');

              // decode from base64
              if (base64PrefixRx.test(content))
                content = new Buffer(content.replace(base64PrefixRx, ''), 'base64').toString('utf-8');

              flowData.files.add({
                source: 'css:import',
                filename: '__?__',
                baseURI: baseURI,
                content: content
              });
            }
            else
            {
              var filename = path.resolve(baseURI, url);

              flowData.files.add({
                source: 'css:import',
                filename: filename,
                baseURI: path.dirname(filename)
              });
            }
          }

          break;

        default:

          walkTree(token, 2);

          break;
      }
    }
  }

  var baseURI = path.dirname(file.filename);

  walkTree([tree]);
}

function buildCssTree(file, flowData){
  //console.log('buildCssTree:', filename);
  var content = file.content;

  // parse css into tree
  var cssTree = csso.parse(content, 'stylesheet');

  // search and extract css files
  processCssTree(cssTree, file, flowData);

  // save ast tree to file definition
  file.ast = cssTree;
}
