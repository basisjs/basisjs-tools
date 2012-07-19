
var at = require('./ast_tools');
var html_at = require('../html/ast_tools');

module.exports = function(flowData){
  //
  // build generic style file (style from js & tmpl)
  //

  var fconsole = flowData.console;
  var queue = flowData.files.queue;


  //
  // Create generic files
  // it contains all css file that doesn't include by styles on page, but includes by templates and others
  //

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.start(file.relpath);

      fconsole.log('Create generic style');
      var genericStyle = flowData.files.add({
        source: 'generic',
        type: 'style',
        baseURI: file.baseURI,
        media: 'all',
        content: '',
        ast: [{}, 'stylesheet'],
        htmlInsertPoint: {
          type: 'tag',
          name: 'link',
          attribs: {
            rel: 'stylesheet',
            type: 'text/css',
            media: 'all'
          }
        }
      });

      fconsole.log('Inject generic file link into html');
      html_at.injectToHead(file.ast, genericStyle.htmlInsertPoint);

      fconsole.log('Fill with imports');
      genericStyle.imports = queue
        .filter(function(file){
          return file.type == 'style' && file.isResource;
        })
        .map(function(file, idx){
          genericStyle.ast.push(
            at.packComment('placeholder'),
            at.packWhiteSpace('\n')
          );

          return {
            token: genericStyle.ast,
            pos: genericStyle.ast.length - 2,
            code: '@import url(' + file.filename + ');',
            file: file,
            media: []
          };
        });

      fconsole.endl();
    }
  }
  fconsole.endl();

  //
  // output files
  //
  flowData.css.packages = queue.filter(function(file){
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
  var baseOutputFilename = file.outputFilename || file.name || 'style';
  var idx = 0;
  var outputFilename = baseOutputFilename;

  while (targetMap[outputFilename])
    outputFilename = baseOutputFilename + (++idx);
  targetMap[outputFilename] = true;

  file.outputFilename = outputFilename + '.css';

  return file.outputFilename;
}