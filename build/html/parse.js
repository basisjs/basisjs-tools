var path = require('path');
var fs = require('fs');
var htmlparser = require("htmlparser2");
var util = require('util');

var parserConfig = {
  lowerCaseTags: true
};

module.exports = function(flowData){
  var inputFile = flowData.inputFile;

  // prepare parser
  var handler = new htmlparser.DefaultHandler();
  var parser = new htmlparser.Parser(handler, parserConfig);

  // parse html
  parser.parseComplete(inputFile.content);

  // debug output
  //console.log(util.inspect(handler.dom, false, null));

  // save result in flowData
  inputFile.ast = handler.dom;
};

module.exports.handlerName = '[html] Parse';