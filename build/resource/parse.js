
var atCss = require('../css/ast_tools');
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
        fconsole.log('Scan (' + file.type + ') ' + file.relpath);
        fconsole.incDeep();

        atCss.walk(file.ast, {
          'uri': function(token){
            fconsole.log('Found ' + atCss.translate(token));

            var filename = atCss.unpackUri(token);

            if (filename)
              filename = path.resolve(file.baseURI, filename);

            files.add({
              source: 'style:url',
              isResource: true,
              filename: filename
            });

            urlMap.push({
              file: file,
              token: token
            });
          }
        });

        fconsole.log();
        fconsole.decDeep();
      break;

      case 'template':
        fconsole.log('Scan (' + file.type + ') ' + file.relpath);
        fconsole.incDeep();

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

        fconsole.log();
        fconsole.decDeep();
      break;
    }
  }
}

module.exports.handlerName = 'Search for resources';