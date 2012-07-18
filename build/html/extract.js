
var htmlparser = require("htmlparser2");
var at = require('./ast_tools');

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
  //console.log(require('util').inspect(handler.dom, false, null));

  // get ast
  var ast = handler.dom;

  // search for head & body
  var head;
  var body;
  at.walk(handler.dom, function(node){
    if (node.type == 'tag')
    {
      if (!head && node.name == 'head')
        head = node;

      if (!body && node.name == 'body')
        body = node;
    }
  });

  ast.head = head || ast;
  ast.body = body || ast;

  // save result in flowData
  inputFile.ast = ast;
};

module.exports.handlerName = '[html] Parse';