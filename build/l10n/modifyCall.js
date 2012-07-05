module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  // process javascript files
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'script' && file.l10nDict.length)
    {
      fconsole.log(file.filename ? flowData.files.relpath(file.filename) : '[inline script]');
      fconsole.incDeep();

      process(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
  }
};

module.exports.handlerName = '[l10n] Modify dictionary declarations';

var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');

function process(file, flowData){
  file.ast = at.walk(file.ast, {
    call: function(expr, args){
      if (at.translate(expr) == CREATE_DICTIONARY)
      {
        var entry = flowData.l10n.defList.shift();

        entry.args[1] = ['string', 'l10n'];

        console.log(JSON.stringify(args));
        console.log(JSON.stringify(entry.args));

        return [
          this[0],
          at.walker.walk(expr),
          entry.args
        ];
      }
    }
  });
}