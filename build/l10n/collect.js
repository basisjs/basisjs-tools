module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? file.relpath : '[inline script]');
      fconsole.incDeep();

      scanFile(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
};

module.exports.handlerName = '[l10n] Collect dictionary declarations';

var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');
var SET_CULTURE_LIST = at.normalize('basis.l10n.setCultureList');

function scanFile(file, flowData){
  var context = flowData.js.getFileContext(file);
  var dictList = {};
  var l10nKeys = [];
  var fconsole = flowData.console;
  var defList = flowData.l10n.defList;

  var l10nDict = [];
  file.l10nDict = l10nDict;

  at.walk(file.ast, {
    call: function(expr, args){
      switch (at.translate(expr))
      {
        case CREATE_DICTIONARY:
          var eargs = at.getCallArgs(args, context);

          defList.push(eargs.concat(file));
          fconsole.log('[FOUND] ' + eargs[0] + ' -> ' + eargs[1]);

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
          
          break;

        case SET_CULTURE_LIST:
          var list = at.getCallArgs(args, context)[0];

          fconsole.log('[FOUND] ' + at.translateCallExpr(expr, args) + ' in ' + file.relpath);

          if (typeof list == 'string')
            list = list.trim().split(/\s+/);

          if (Array.isArray(list))
          {
            fconsole.log('        [OK] Set culture list ' + JSON.stringify(list));
            list.forEach(flowData.l10n.cultureList.add, flowData.l10n.cultureList);
          }
          else
          {
            fconsole.log('        [!] Can\'t convert into array (ignored)');
          }


          break;
      }
    }
  });
  
  flowData.l10nKeys.push.apply(flowData.l10nKeys, l10nKeys);
  for (var i in dictList)
    flowData.dictList[i] = dictList[i];
}