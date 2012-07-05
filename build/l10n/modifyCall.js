module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  //

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
var path = require('path');


function process(file, flowData){
  var context = flowData.js.getFileContext(file);

  file.ast = at.walk(file.ast, {
    call: function(expr, args){
      if (at.isAstEqualsCode(expr, 'basis.l10n.createDictionary'))
      {
        var newArgs = at.getCallArgs(args, context);
        var id = newArgs[0];
        var tokens = newArgs[2];
        var dict = {};
        dict[id] = tokens;

        var newTokens = flowData.l10n.packDictionary(dict);

        newArgs[0] = ['string', id];
        newArgs[1] = ['string', ''];
        newArgs[2] = ['array', newTokens.map(function(token){
          return [typeof token == 'number' ? 'num' : 'string', token];
        })];

        return [ this[0], at.walker.walk(expr), at.map(newArgs) ];
      }
    }
  });

}