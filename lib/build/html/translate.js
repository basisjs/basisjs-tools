
var at = require('../../ast').html;

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      if (!file.outputFilename)
        file.outputFilename = file.basename;

      fconsole.log(file.relpath + ' -> ' + file.outputFilename);

      file.outputContent = at.translate(file.ast);
    }
  }
}

module.exports.handlerName = '[html] Translate';