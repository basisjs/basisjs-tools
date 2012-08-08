
var at = require('./ast_tools');
var html_at = require('../html/ast_tools');

module.exports = function(flow){
  //
  // build generic style file (style from js & tmpl)
  //

  var fconsole = flow.console;
  var queue = flow.files.queue;


  //
  // Create generic files
  // it contains all css file that doesn't include by styles on page, but includes by templates and others
  //

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html' && file.ast)
    {
      fconsole.start(file.relpath);

      fconsole.log('Create generic style');
      var genericStyle = flow.files.add({
        type: 'style',
        baseURI: file.baseURI,
        media: 'all',
        content: '',
        ast: [{}, 'stylesheet'],
        htmlNode: {
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
      html_at.injectToHead(file.ast, genericStyle.htmlNode);
      file.link(genericStyle);

      fconsole.log('Fill with imports');
      genericStyle.imports = queue
        .filter(function(file){
          return file.type == 'style' && file.isResource;
                                         // !file.hasLinkType('style') && !file.hasLinkType('html');                              
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
  flow.css.packages = queue.filter(function(file){
    if (file.type == 'style' && file.htmlNode)
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