
var path = require('path');
var fs = require('fs');
var csso = require('csso');

module.exports = function(flowData){
  var outputFiles = flowData.css.outputFiles;

  for (var i = 0, file; file = outputFiles[i]; i++)
  {
    flowData.console.log(file.outputFilename);

    // write to file
    fs.writeFileSync(
      file.outputFilename,
      csso.translate(csso.cleanInfo(file.ast)),
      'utf-8'
    );

    // replace token in html
    flowData.html.replaceToken(file.htmlInsertPoint, {
      type: 'tag',
      name: 'link',
      attribs: {
        rel: 'stylesheet',
        type: 'text/css',
        media: 'all',
        href: path.relative(flowData.buildDir, file.outputFilename)
      }
    });
  }
}

module.exports.handlerName = 'Write css files and modify html';