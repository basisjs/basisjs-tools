
var atCss = require('../css/ast_tools');
var utils = require('../misc/utils');
var path = require('path');

module.exports = function(flowData){
  var atTmpl = require('../tmpl/ast_tools');

  var files = flowData.files;
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  var urlMap = [];

  for (var i = 0, file; file = queue[i]; i++)
  {
    switch (file.type)
    {
      case 'style':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atCss.walk(file.ast, {
          'uri': function(token){
            fconsole.log('Found ' + atCss.translate(token));

            var uri = utils.resolveUri(atCss.unpackUri(token));

            if (uri.filename)
            {
              var filename = path.resolve(file.baseURI, uri.filename);

              var resFile = files.add({
                source: 'style:url',
                filename: filename
              });
              resFile.cssResource = true;
              resFile.outputFilename = 'res/' + resFile.digest + path.extname(filename);
              resFile.fileRef = resFile.relOutputFilename;

              atCss.packUri(resFile.fileRef, token);
            }
            /*urlMap.push({
              file: file,
              token: token
            });*/
          }
        });

        fconsole.endl();
      break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atTmpl.walk(file.ast, {
          attr: function(token, parentToken){
            switch (atTmpl.tokenName(token))
            {
              case 'src':
                if (atTmpl.tokenName(parentToken) == 'img')
                  fconsole.log('Found <img src="' + atTmpl.tokenValue(token) + '"/>');
                break;
            }
          }
        })

        fconsole.endl();
      break;
    }
  }
}

module.exports.handlerName = '[res] Search for resources';