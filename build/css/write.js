
var path = require('path');
var fs = require('fs');
var csso = require('csso');

module.exports = function(flowData){
  var outputFiles = flowData.css.outputFiles;
  var mergeFile;
  var singleFileMode;

  // write
  for (var i = 0, file; file = outputFiles[i]; i++)
  {
    var fileContent = csso.translate(csso.cleanInfo(file.ast));

    // write to file
    if (fileContent)
    {
      flowData.console.log('Write ' + file.relOutputFilename);
      fs.writeFileSync(
        file.outputFilename,
        fileContent,
        'utf-8'
      );
    }
    else
    {
      flowData.console.log('File ' + file.relOutputFilename + ' is empty - reject');
    }

    // replace token in html
    flowData.html.replaceToken(file.htmlInsertPoint,
      fileContent
        ? {
            type: 'tag',
            name: 'link',
            attribs: {
              rel: 'stylesheet',
              type: 'text/css',
              media: file.media,
              href: file.relOutputFilename + '?' + file.digest
            }
          }
        : {
            type: 'text',
            data: ''
          }
    );
  }
}

module.exports.handlerName = 'Write css files and modify html';
