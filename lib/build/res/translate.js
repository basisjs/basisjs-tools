module.exports = function(flow){
  var fconsole = flow.console;

  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.cssResource)
    {
      fconsole.log(file.relpath);
      file.outputContent = file.content;
    }
  }
};

module.exports.handlerName = '[res] Translate';
