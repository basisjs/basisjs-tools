module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  // process javascript files
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'script' && file.hasL10n)
    {
      fconsole.log(file.filename ? flowData.files.relpath(file.filename) : '[inline script]');
      fconsole.incDeep();

      process(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
  }
};

module.exports.handlerName = '[l10n] Modify createDictionary/getToken calls';

var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');
var GET_TOKEN = at.normalize('basis.l10n.getToken');

function process(file, flowData){
  file.ast = at.walk(file.ast, {
    call: function(expr, args){
      switch (at.translate(expr))
      {
        case CREATE_DICTIONARY:
          var entry = flowData.l10n.defList.shift();
          flowData.console.log(entry.name);

          entry.args[1] = ['string', 'l10n'];

          return [
            this[0],
            expr,
            entry.args
          ];

        case GET_TOKEN:
          if (args.length == 1 && args[0][0] == 'string')
          {
            var entry = flowData.l10n.getTokenList.shift();

            return [
              this[0],
              expr,
              entry.args
            ];
          }

          break;
      }
    }
  });
}