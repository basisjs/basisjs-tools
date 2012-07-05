
var path = require('path');
var at = require('./ast_tools');

module.exports = function(flowData){
  //
  // build generic style file (style from js & tmpl)
  //

  var fconsole = flowData.console;
  var genericFile = flowData.css.genericFile;

  genericFile.ast = [{}, 'stylesheet'];
  genericFile.imports = flowData.files.queue
    .filter(function(file){
      return file.type == 'style' && file.isResource;
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
  // output files
  //
  flowData.css.packages = flowData.files.queue.filter(function(file){
    if (file.type == 'style' && file.htmlInsertPoint)
    {
      setOutputFilename(file, this);

      fconsole.log(file.relOutputFilename);

      return file;
    }
  }, {});
}

module.exports.handlerName = '[css] Make packages';

function setOutputFilename(file, targetMap){
  var baseOutputFilename = file.outputFilename || (file.filename ? path.basename(file.filename, '.css') : '') || 'style';
  var idx = 0;
  var outputFilename = baseOutputFilename;

  while (targetMap[outputFilename])
    outputFilename = baseOutputFilename + (++idx);
  targetMap[outputFilename] = true;

  file.outputFilename = outputFilename + '.css';

  return file.outputFilename;
}