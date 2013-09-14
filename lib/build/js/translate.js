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
        file.outputContent = at.translate(file.ast, {
          inline_script: !file.outputFilename
        });
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

