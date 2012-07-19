
var at = require('./ast_tools');
var html_at = require('../html/ast_tools');

module.exports = function(flow){
  var fconsole = flow.console;

  // merge files
  if (flow.options.cssSingleFile)
  {
    var packages = flow.css.packages;
    var newPackages = [];
    var idx = '';
    
    for (var i = 0, file, prev; file = packages[i]; i++)
    {
      var filename = file.outputFilename;
      if (prev && prev.media == file.media)
      {
        prev.ast.push.apply(prev.ast, file.ast.slice(2));
        html_at.removeToken(file.htmlNode);
      }
      else
      {
        if (prev)
        {
          fconsole.endl();
        }

        prev = file;
        newPackages.push(file);

        file.outputFilename = 'style' + idx + '.css';
        idx++;
        fconsole.start('Merge into ' + file.relOutputFilename + ' (media: ' + file.media + ')');
      }

      fconsole.log(file.relpath);
    }

    flow.css.packages = newPackages;
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Don\'t use --no-css-single-file or --no-single-file to allow css file merge.');
  }
}

module.exports.handlerName = '[css] Merge packages';