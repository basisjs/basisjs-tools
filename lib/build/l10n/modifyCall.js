module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  // process javascript files
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'script' && file.hasL10n)
    {
      fconsole.start(file.relpath);

      process(file, flow);

      fconsole.endl();
    }
  }
};

module.exports.handlerName = '[l10n] Modify createDictionary/getToken calls';

var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');
var GET_TOKEN = at.normalize('basis.l10n.getToken');

function process(file, flow){
  file.ast = at.walk(file.ast, {
    "call": function(token){
      var expr = token[1];
      var args = token[2];

      switch (at.translate(expr))
      {
        case CREATE_DICTIONARY:
          var entry = flow.l10n.defList.shift();
          flow.console.log(entry.name);

          entry.args[1] = ['string', 'l10n'];

          return [
            'call',
            expr,
            entry.args
          ];

        case GET_TOKEN:
          if (args.length == 1 && args[0][0] == 'string')
          {
            var entry = flow.l10n.getTokenList.shift();

            return [
              'call',
              expr,
              entry.args
            ];
          }

          break;
      }
    }
  });
}