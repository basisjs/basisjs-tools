
var at = require('./ast_tools');

module.exports = function(flowData){
  var fconsole = flowData.console;

  flowData.css.outputFiles.filter(function(file){
    file.outputContent = at.translate(file.ast);

    var isEmpty = !file.outputContent.length;

    if (isEmpty)
    {
      fconsole.log('[!] ' + file.relOutputFilename + ' is empty - reject');

      // 'cut' token from html
      flowData.html.replaceToken(file.htmlInsertPoint, {
        type: 'text',
        data: ''
      });
    }
    else
    {
      fconsole.log('[OK] ' + file.relOutputFilename)
    }

    return !isEmpty; // keep not empty
  });
}

module.exports.handlerName = 'Translate CSS into text';
