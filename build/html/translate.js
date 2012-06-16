var htmlparser = require('htmlparser2');
var path = require('path');
var fs = require('fs');

module.exports = function(flowData){
  var inputFile = flowData.inputFile;

  inputFile.outputFilename = path.basename(flowData.inputFilename);
  inputFile.outputContent = inputFile.ast.map(htmlparser.DomUtils.getOuterHTML, htmlparser.DomUtils).join('');
}