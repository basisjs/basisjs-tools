
var path = require('path');
var fs = require('fs');
var csso = require('csso');

module.exports = function(flowData){
  var fconsole = flowData.console;

  flowData.css.outputFiles.filter(function(file){
    file.outputContent = csso.translate(csso.cleanInfo(file.ast));

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
      file.addToOutput();
    }

    return !isEmpty; // keep not empty
  });
}

module.exports.handlerName = 'Translate CSS into text';
