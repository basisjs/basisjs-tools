//
// export handler
//

var at = require('../../ast').js;

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  at.translateDefaults({
    beautify: !flow.options.pack,
    indent_level: 2
  });

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.relpath);

      file.outputContent = at.translate(file.ast, {
        inline_script: !file.outputFilename
      });

      if (file.isResource)
      {
        try {
          file.jsResourceContent = new Function('return ' + file.outputContent)();
        } catch(e) {
          file.jsResourceContent = Function('"Compilation error: ' + (file.relpath + ' (' + e).replace(/\"/g, '\\"') + ')";//[ERROR] Compilation error: ' + file.relpath + ' (' + e + ')');
          fconsole.log('[ERROR] Compilation error: ' + file.relpath + ' (' + e + ')');
        }
      }
    }
};

module.exports.handlerName = '[js] Translate';

