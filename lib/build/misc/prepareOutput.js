module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.output)
    {
      file.outputContent = file.content;
      file.outputFilename = flow.outputResourceDir + file.digest + file.ext;
      file.fileRef = file.relOutputFilename;
      fconsole.log(file.relpath + ' -> ' + file.relOutputFilename);
    }
};

module.exports.handlerName = '[fs] Prepare output files';
