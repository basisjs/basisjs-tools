var fs = require('fs');
var path = require('path');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  if (flow.options.target == 'zip')
  {
    fconsole.start('Target is zip file.');

    var Zip = require('node-zip');
    var zipper = new Zip();

    // add files to archive
    fconsole.log('Build zip archive.');
    for (var i = 0, file; file = queue[i]; i++)
    {
      if (file.outputFilename && 'outputContent' in file)
      {
        fconsole.log(file.relpath + ' -> ' + file.relOutputFilename);
        zipper.file(file.outputFilename, file.outputContent, {
          binary: file.encoding == 'binary'
        });
      }
    }

    // fetch base name for archive
    var firstFile = flow.files.queue[0];
    var baseName = firstFile.filename || 'build.ext';

    // clear file queue
    fconsole.log('Drop all output files.');
    flow.files.clear();

    // add archive as single result file
    fconsole.log('Add archive as single result file.');
    flow.files.add({
      outputFilename: path.basename(baseName, path.extname(baseName)) + '.zip',
      outputContent: zipper.generate({
        base64: false/*,
        compression: 'DEFLATE'*/ // buggy for some kind of binary data
      })
    });
  }
};

module.exports.handlerName = '[misc] Archive files';
