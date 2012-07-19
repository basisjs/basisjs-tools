
var fs = require('fs');
var path = require('path');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  //
  // Create output folders (if required)
  //

  flow.files.mkdir(flow.options.output);
  flow.files.mkdir(path.resolve(flow.options.output, flow.outputResourceDir));


  //
  // Save files content
  //

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.outputFilename && 'outputContent' in file)
    {
      fconsole.log(file.relpath + ' -> ' + file.relOutputFilename);
      fs.writeFile(path.resolve(flow.options.output, file.outputFilename), file.outputContent, file.encoding);
    }
  }

}

module.exports.handlerName = '[fs] Write output files';