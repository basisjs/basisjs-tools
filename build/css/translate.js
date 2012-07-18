
var at = require('./ast_tools');
var html_at = require('../html/ast_tools');

module.exports = function(flowData){
  var fconsole = flowData.console;

  flowData.css.packages.filter(function(file){
    var outputContent = at.translate(file.ast);
    var isEmpty = !outputContent.length;

    if (isEmpty)
    {
      fconsole.log('[!] ' + file.relOutputFilename + ' is empty - reject');

      // 'cut' token from html
      html_at.replaceToken(file.htmlInsertPoint, {
        type: 'text',
        data: ''
      });
    }
    else
    {
      fconsole.log('[OK] ' + file.relOutputFilename)

      file.outputContent = outputContent;

      // replace token in html
      html_at.replaceToken(file.htmlInsertPoint, {
        type: 'tag',
        name: 'link',
        attribs: {
          rel: 'stylesheet',
          type: 'text/css',
          media: file.media,
          href: file.relOutputFilename + '?' + file.digest
        }
      });
    }

    return !isEmpty; // keep not empty
  });
}

module.exports.handlerName = '[css] Translate';
