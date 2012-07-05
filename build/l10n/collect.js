module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      // scan file for basis.l10n.createDictionary & basis.l10n.setCultureList
      fconsole.log(file.filename ? file.relpath : '[inline script]');
      fconsole.incDeep();

      // store reference for basis.l10n module
      if (file.namespace == 'basis.l10n')
      {
        fconsole.log('[i] basis.l10n module found, store reference for it');
        flowData.l10n.module = file;
      }

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
          var entry = {
            args: args,
            name: eargs[0],
            path: eargs[1],
            keys: eargs[2],
            file: file
          };

          defList.push(entry);
          fconsole.log('[FOUND] ' + entry.name + ' -> ' + entry.path);

          keys = Object.keys(eargs[2]);
          
          var dict = {
            path: eargs[1],
            keys: keys
          };

          l10nDict.push(dict);
          dictList[eargs[0]] = dict;

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
  
  for (var i in dictList)
    flowData.dictList[i] = dictList[i];
}