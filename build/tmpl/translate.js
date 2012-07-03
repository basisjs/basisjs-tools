
module.exports = function(flowData){
  var at = require('./ast_tools');
  var fconsole = flowData.console;
  var queue = flowData.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.log(file.relpath);
      file.jsResourceContent = file.ast;
    }
  }
}

module.exports.handlerName = 'Translate templates';
