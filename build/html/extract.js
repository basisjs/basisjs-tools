
module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.start(file.relPath);

      processFile(file);

      fconsole.endl();
    }
  }
};

module.exports.handlerName = '[html] Extract';

//
// Main part, process files
//

var at = require('./ast_tools');

function processFile(file){
  // get ast
  var ast = at.parse(file.content);

  // debug output
  //console.log(require('util').inspect(ast, false, null));

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
