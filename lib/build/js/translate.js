//
// export handler
//

var at = require('../../ast').js;

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
      if (!file.isResource && file !== basisFile)
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

          file.outputContent = '\n' + at.translate(file.ast, {
            inline_script: !file.outputFilename,
            indent_start: indent_start
          }) + '\n' + ' '.repeat(indent_start - 2);
        }
        else
        {
          file.outputContent = at.translate(file.ast, translateConfig);
        }
      }

      // if (file.isResource)
      // {
      //   try {
      //     file.jsResourceContent = new Function('return ' + file.outputContent)();
      //   } catch(e) {
      //     file.jsResourceContent = Function('"Compilation error: ' + (file.relpath + ' (' + e).replace(/\"/g, '\\"') + ')";//[ERROR] Compilation error: ' + file.relpath + ' (' + e + ')');
      //     flow.warn({
      //       file: file.relpath,
      //       message: 'Compilation error: ' + (e.message || e)
      //     });
      //   }
      // }
    }

};

module.exports.handlerName = '[js] Translate';

