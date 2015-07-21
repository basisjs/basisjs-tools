//
// export handler
//

var at = require('../../ast').js;
var utils = require('../../common/utils');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;
  var basisFile = flow.js.basisScript && flow.files.get(flow.js.basisScript);

  at.translateDefaults({
    beautify: !flow.options.pack,
    indent_level: 2
  });

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      if ((file.htmlNode || file.outputFilename) && file !== basisFile)
      {
        fconsole.log(file.relpath);

        if (!file.outputFilename)
        {
          var indent_start = 0;

          if (!flow.options.pack)
          {
            indent_start = 2;
            if (file.htmlNode && file.htmlNode.parent)
            {
              var children = file.htmlNode.parent.children;
              var idx = children.indexOf(file.htmlNode);

              if (idx > 0)
              {
                prevNode = children[idx - 1];
                if (prevNode.type == 'text')
                  indent_start = prevNode.data.split(/[\r\n]+/).pop().length + 2;
              }
            }
          }

          file.outputContent = at.translate(file.originalAst || file.ast, {
            inline_script: !file.outputFilename,
            indent_start: indent_start
          });

          if (indent_start)
            file.outputContent = '\n' + file.outputContent + '\n' + utils.repeat(' ', Math.max(0, indent_start - 2));
        }
        else
        {
          file.outputContent = at.translate(file.originalAst || file.ast);
        }
      }
    }

};

module.exports.handlerName = '[js] Translate';

