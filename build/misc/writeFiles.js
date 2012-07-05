
var fs = require('fs');

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.outputFilename && 'outputContent' in file)
    {
      fconsole.log(file.relpath + ' -> ' + file.relOutputFilename);
      fs.writeFile(file.outputFilename, file.outputContent, file.encoding);
    }
  }
}

module.exports.handlerName = '[fs] Write output files';