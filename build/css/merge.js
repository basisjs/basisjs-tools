
var at = require('./ast_tools');

module.exports = function(flowData){
  var fconsole = flowData.console;

  // merge files
  if (flowData.options.cssSingleFile)
  {
    var packages = flowData.css.packages;
    var newPackages = [];
    var idx = '';
    
    for (var i = 0, file, prev; file = packages[i]; i++)
    {
      var filename = file.outputFilename;
      if (prev && prev.media == file.media)
      {
        prev.ast.push.apply(prev.ast, file.ast.slice(2));
        flowData.html.removeToken(file.htmlInsertPoint)
      }
      else
      {
        if (prev)
        {
          fconsole.log();
          fconsole.decDeep();
        }

        prev = file;
        newPackages.push(file);

        file.outputFilename = 'style' + idx + '.css';
        idx++;
        fconsole.log('Merge into ' + file.relOutputFilename + ' (media: ' + file.media + ')');
        fconsole.incDeep();
      }

      fconsole.log(file.relpath);
    }

    flowData.css.packages = newPackages;
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Don\'t use --no-css-single-file or --no-single-file to allow css file merge.');
  }
}

module.exports.handlerName = 'Merge CSS packages';