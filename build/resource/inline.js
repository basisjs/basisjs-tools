
module.exports = function(flowData){
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