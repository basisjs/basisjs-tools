
var at = require('./ast_tools');

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.log(file.relpath);

      file.outputFilename = file.basename;
      file.outputContent = at.translate(file.ast);
    }
  }
}

module.exports.handlerName = '[html] Translate';