
module.exports = function(flow){
  var uniqueMap = {};

  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.cssResource)
    {
      if (!uniqueMap[file.digest])
      {
        uniqueMap[file.digest] = true;
        file.outputContent = file.content;
      }
    }
  }
}

module.exports.handlerName = '[res] Translate';