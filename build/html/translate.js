
var at = require('./ast_tools');
var path = require('path');

module.exports = function(flowData){
  var inputFile = flowData.inputFile;

  inputFile.outputFilename = path.basename(flowData.inputFilename);
  inputFile.outputContent = at.translate(inputFile.ast);
}

module.exports.handlerName = '[html] Translate';