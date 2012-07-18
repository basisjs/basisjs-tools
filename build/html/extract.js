
module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.start(file.relPath);

      processFile(file, flowData);

      fconsole.endl();
    }
  }
};

module.exports.handlerName = '[html] Extract';

//
//
//

var htmlparser = require('htmlparser2');
var at = require('./ast_tools');

var parserConfig = {
  lowerCaseTags: true
};

function processFile(file, flowData){
  // prepare parser
  var handler = new htmlparser.DefaultHandler();
  var parser = new htmlparser.Parser(handler, parserConfig);

  // parse html
  parser.parseComplete(file.content);

  // debug output
  //console.log(require('util').inspect(handler.dom, false, null));

  // get ast
  var ast = handler.dom;

  // search for head & body
  var head;
  var body;

  at.walk(ast, function(node){
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

  // save result in file
  file.ast = ast;
}
