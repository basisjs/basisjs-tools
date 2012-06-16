
module.exports = function(flowData){
  var queue = flowData.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.cssResource)
    {
      file.outputContent = file.content;
    }
  }
}