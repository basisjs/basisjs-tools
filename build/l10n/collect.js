module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;


  flowData.dictList = {};
  flowData.l10nKeys = [];

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? flowData.files.relpath(file.filename) : '[inline script]');
      fconsole.incDeep();

      process(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
};

module.exports.handlerName = 'Collect l10n dictionary declarations';

var path = require('path');

var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');

function process(file, flowData){
  var context = flowData.js.getFileContext(file);
  var dictList = {};
  var l10nKeys = [];

  var l10nDict = [];
  file.l10nDict = l10nDict;

  at.walk(file.ast, {
    call: function(expr, args){
      if (at.translate(expr) == CREATE_DICTIONARY)
      {
        var eargs = at.getCallArgs(args, context);
        keys = Object.keys(eargs[2]);

        var dict = {
          path: eargs[1],
          keys: keys
        };

        l10nDict.push(dict);
        dictList[eargs[0]] = dict;

        keys.forEach(function(key){
          l10nKeys.push(eargs[0] + '.' + key);
        });  
      }
    }
  });
  
  flowData.l10nKeys.push.apply(flowData.l10nKeys, l10nKeys);
  for (var i in dictList)
    flowData.dictList[i] = dictList[i];
}