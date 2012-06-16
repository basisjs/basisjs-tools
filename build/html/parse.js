var path = require('path');
var fs = require('fs');
var htmlparser = require("htmlparser2");
var util = require('util');

var parserConfig = {
  lowerCaseTags: true
};

module.exports = function(flowData){
  var filename = flowData.inputFilename;

  // check html file exists
  if (!path.existsSync(filename))
  {
    console.warn(filename + ' not found');
    process.exit();
  }

  var inputFile = flowData.files.add({
    filename: filename
  });

  // prepare parser
  var handler = new htmlparser.DefaultHandler();
  var parser = new htmlparser.Parser(handler, parserConfig);

  // parse html
  parser.parseComplete(inputFile.content);

  // debug output
  //console.log(util.inspect(handler.dom, false, null));

  // save result in flowData
  flowData.html.inputFile = inputFile;
  inputFile.ast = handler.dom;
};

module.exports.handlerName = 'Parse html';