
module.exports = function(flow){
  var at = require('./ast_tools');
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.log(file.relpath);
      file.jsResourceContent = file.ast;
    }
  }
}

module.exports.handlerName = '[tmpl] Translate';
