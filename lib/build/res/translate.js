
module.exports = function(flow){
  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.cssResource)
      file.outputContent = file.content;
  }
}

module.exports.handlerName = '[res] Translate';