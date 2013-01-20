
var fs = require('fs');
var path = require('path');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  // Create output folders (if required)
  //flow.files.mkdir(flow.options.output);

  //
  // Save output files to disk
  //

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.outputFilename && 'outputContent' in file)
    {
      fconsole.log(file.relpath + ' -> ' + file.relOutputFilename);

      fs.writeFile(
        resolveDirPath(fconsole, path.resolve(flow.options.output, file.outputFilename)),
        file.outputContent,
        file.encoding
      );
    }
  }
}

module.exports.handlerName = '[fs] Write output files';


function resolveDirPath(fconsole, filename){
  var dirpath = path.dirname(path.normalize(filename));
  if (!fs.existsSync(dirpath))
  {
    var parts = dirpath.split(path.sep);
    var curpath = parts[0] + path.sep;
    for (var i = 1; i < parts.length; i++)
    {
      curpath += parts[i] + path.sep;
      //console.log(curpath, parts[i], fs.existsSync(curpath));
      if (!fs.existsSync(curpath))
      {
        fconsole.log('Create dir', curpath);
        fs.mkdirSync(curpath);
      }
    }
  }
  return filename;
}