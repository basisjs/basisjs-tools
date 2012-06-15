
var path = require('path');
var fs = require('fs');
var csso = require('csso');

module.exports = function(flowData){
  var outputFiles = flowData.css.outputFiles;

  // write
  for (var i = 0, file; file = outputFiles[i]; i++)
  {
    // write to file
    flowData.console.log('Write ' + file.relOutputFilename);
    fs.writeFileSync(
      file.outputFilename,
      file.outputContent,
      'utf-8'
    );

    // replace token in html
    flowData.html.replaceToken(file.htmlInsertPoint, {
      type: 'tag',
      name: 'link',
      attribs: {
        rel: 'stylesheet',
        type: 'text/css',
        media: file.media,
        href: file.fileRef
      }
    });
  }
}

module.exports.handlerName = 'Write css files and modify html';
