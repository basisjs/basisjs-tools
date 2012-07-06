module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  /*global.xcount = 0;
  global.xsize= 0;*/
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

  //console.log('getToken count:', xcount, xsize);
};

module.exports.handlerName = '[l10n] Collect dictionary declarations';

var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');
var GET_TOKEN = at.normalize('basis.l10n.getToken');
var SET_CULTURE_LIST = at.normalize('basis.l10n.setCultureList');

function scanFile(file, flowData){
  var context = flowData.js.getFileContext(file);
  var fconsole = flowData.console;
  var defList = flowData.l10n.defList;
  var getTokenList = flowData.l10n.getTokenList;

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

          fconsole.log('[FOUND] createDictionary ' + entry.name + ' -> ' + entry.path);

          file.hasL10n = true;
          defList.push(entry);

          break;

        //case L10N_TOKEN:
        case GET_TOKEN:
          if (args.length == 1 && args[0][0] == 'string')
          {
            fconsole.log('[FOUND] getToken ' + args[0][0]);

            file.hasL10n = true;
            getTokenList.push({
              args: args,
              file: file
            });
            /*console.log('~~~', at.translateCallExpr(expr, args));
            xsize += args[0][1].length - 3;
            xcount++;*/
          }
          break;

        case SET_CULTURE_LIST:
          var list = at.getCallArgs(args, context)[0];

          fconsole.log('[FOUND] ' + at.translateCallExpr(expr, args) + ' in ' + file.relpath);

          if (typeof list == 'string')
            list = list.trim().split(/\s+/);

          if (Array.isArray(list))
          {
            for (var i = 0, cultureDef; cultureDef = list[i]; i++)
            {
              var clist = cultureDef.split(/\//);
              list[i] = clist[0];
            }

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
}