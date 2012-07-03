//
// export handler
//

var at = require('./ast_tools');

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? file.relpath : '[inline script]');

      file.outputContent = at.translate(file.ast);

      try {
        file.jsResourceContent = new Function('exports, module, basis, global, __filename, __dirname, resource', file.outputContent);
      } catch(e) {
        fconsole.warn('[ERROR] Compilation error: ' + file.relpath);

        file.jsResourceContent = Function();
      }

    }
};

module.exports.handlerName = 'Translate javascript';

