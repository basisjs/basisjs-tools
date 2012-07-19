
var fs = require('fs');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  //
  // Create output folders (if required)
  //

  flow.files.mkdir(flow.outputDir);
  flow.files.mkdir(flow.outputResourceDir);


  //
  // Save files content
  //

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