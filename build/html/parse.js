var path = require('path');
var fs = require('fs');
var htmlparser = require("htmlparser2");
var util = require('util');

var parserConfig = {
  lowerCaseTags: true
};

module.exports = function(flowData){
  var filename = flowData.buildFile;

  if (!path.existsSync(filename))
  {
    console.warn(filename + ' not found');
    process.exit();
  }

  var rawHtml = fs.readFileSync(filename, 'utf-8');
  var handler = new htmlparser.DefaultHandler();
  var parser = new htmlparser.Parser(handler, parserConfig);
  parser.parseComplete(rawHtml);

  //console.log(util.inspect(handler.dom, false, null));

  flowData.htmlTokens = handler.dom;
};

module.exports.handlerName = 'Parse html';