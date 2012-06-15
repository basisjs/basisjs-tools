
var path = require('path');
var at = require('./ast_tools');

module.exports = function(flowData){
  var outputDir = flowData.outputDir;
  var outputFiles = flowData.files.queue.filter(function(file){
    if (file.type == 'style' && file.htmlInsertPoint)
      return file;
  });

  // save output files
  flowData.css.outputFiles = outputFiles;


  //
  // build generic style file (style from js & tmpl)
  //

  var genericFile = flowData.css.genericFile;

  genericFile.ast = [{}, 'stylesheet'];
  genericFile.imports = flowData.files.queue
    .filter(function(file){
      return file.type == 'style' && file.generic;
    })
    .map(function(file, idx){
      genericFile.ast.push(
        at.packComment('placeholder'),
        at.packWhiteSpace('\n')
      );

      return {
        token: genericFile.ast,
        pos: genericFile.ast.length - 2,
        code: '@import url(' + file.filename + ');',
        file: file,
        media: []
      };
    });

  //
  // prepare output files
  //

  // make target filename for output
  for (var i = 0, file, targetMap = {}; file = outputFiles[i]; i++)
  {
    var baseOutputFilename = file.outputFilename || (file.filename ? path.basename(file.filename, '.css') : '') || 'style';
    var idx = 0;
    var outputFilename = baseOutputFilename;

    while (targetMap[outputFilename])
      outputFilename = baseOutputFilename + (++idx);

    file.outputFilename = outputFilename + '.css';
    targetMap[file.outputFilename] = true;
  }
}