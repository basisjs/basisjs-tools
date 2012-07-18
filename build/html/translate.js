
var at = require('./ast_tools');
var path = require('path');

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.log(file.relpath);

      file.outputFilename = path.basename(file.filename);
      file.outputContent = at.translate(file.ast);
    }
  }
}

module.exports.handlerName = '[html] Translate';