var path = require('path');
var fs = require('fs');
var htmlparser = require("htmlparser2");
var util = require('util');

var parserConfig = {
  lowerCaseTags: true
};

module.exports = function(flowData){
  var filename = flowData.buildFile;

  // check html file exists
  if (!path.existsSync(filename))
  {
    console.warn(filename + ' not found');
    process.exit();
  }

  // get html file content
  var rawHtml = fs.readFileSync(filename, 'utf-8');

  // prepare parser
  var handler = new htmlparser.DefaultHandler();
  var parser = new htmlparser.Parser(handler, parserConfig);

  // parse html
  parser.parseComplete(rawHtml);

  // debug output
  //console.log(util.inspect(handler.dom, false, null));

  // save result in flowData
  flowData.html.ast = handler.dom;
};

module.exports.handlerName = 'Parse html';