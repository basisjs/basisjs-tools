
module.exports = function(flowData){
  var uniqueMap = {};

  for (var i = 0, file; file = flowData.files.queue[i]; i++)
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