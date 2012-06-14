
var path = require('path');
var fs = require('fs');
var csso = require('csso');

module.exports = function(flowData){
  var outputFiles = flowData.css.outputFiles;
  var mergeFile;
  var singleFileMode;

  // merge files
  if (flowData.options.cssSingleFile)
  {
    var ast = [{}, 'stylesheet'];

    flowData.css.outputFiles.forEach(function(importFile, idx){
      ast.push.apply(ast, importFile.ast.slice(2));
    });

    singleFileMode = true;
    mergeFile = {
      outputFilename: path.resolve(flowData.buildDir + '/style.css'),
      ast: ast
    };
  }

  // write
  for (var i = 0, file; file = outputFiles[i]; i++)
  {
    var insertPoint = file.htmlInsertPoint;
    var fileContent = '';

    if (singleFileMode)
    {
      if (file = mergeFile)
        mergeFile = null;
    }

    if (file)
    {
      fileContent = csso.translate(csso.cleanInfo(file.ast));
      flowData.console.log(file.outputFilename);

      // write to file
      if (fileContent)
      {
        fs.writeFileSync(
          file.outputFilename,
          fileContent,
          'utf-8'
        );
      }
    }

    // replace token in html
    flowData.html.replaceToken(insertPoint,
      fileContent
        ? {
            type: 'tag',
            name: 'link',
            attribs: {
              rel: 'stylesheet',
              type: 'text/css',
              media: 'all',
              href: path.relative(flowData.buildDir, file.outputFilename)
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
