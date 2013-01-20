
module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  flow.l10n.packages = [];


  //
  // Scan javascript for l10n
  //

  /*fconsole.start('Scan javascript');
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'script')
    {
      // scan file for basis.l10n.createDictionary & basis.l10n.setCultureList
      fconsole.start(file.relpath);

      // store reference for basis.l10n module
      if (file.namespace == 'basis.l10n')
      {
        fconsole.log('[i] basis.l10n module found, store reference for it');
        flow.l10n.module = file;
      }

      scanFile(file, flow);

      fconsole.endl();
    }
  }
  fconsole.endl();*/

  //
  // Add dictionary files
  //

  fconsole.start('Fetch dictionary files');
  for (var path in flow.l10n.pathes)
  {
    fconsole.start(reldir(flow, path));
    for (var i = 0; culture = flow.l10n.cultureList[i]; i++)
    {
      var dictFile = flow.files.add({
        filename: path + '/' + culture + '.json',
        type: 'l10n',
        culture: culture
      });

      flow.l10n.pathes[path].__files.forEach(function(file){
        file.link(dictFile);
      });
    }
    fconsole.endl();
  }
};

module.exports.handlerName = '[l10n] Extract';


//
// Main part
//

var path = require('path');
//var at = require('../js/ast_tools');

function reldir(flow, dir){
  return path.relative(flow.options.base, dir).replace(/\\/g, '/') + '/';  // [base]
}
/*
function scanFile(file, flow){
  var context = flow.js.getFileContext(file);
  var fconsole = flow.console;

  var defList = flow.l10n.defList;
  var getTokenList = flow.l10n.getTokenList;
  var pathes = flow.l10n.pathes;
  var cultureList = flow.l10n.cultureList;

  at.walk(file.ast, {
    "call": function(token){
      var expr = token[1];
      var args = token[2];

      switch (at.resolveName(expr, true))
      {
        case 'basis.l10n.createDictionary1':
          var eargs = at.getCallArgs(args, context);
          var entry = {
            args: args,
            name: eargs[0],
            path: path.resolve(flow.options.base, eargs[1]),
            keys: eargs[2],
            file: file
          };

          fconsole.log('[FOUND] createDictionary ' + entry.name + ' -> ' + reldir(flow, entry.path));

          file.hasL10n = true;
          defList.push(entry);

          if (!pathes[entry.path])
            pathes[entry.path] = { __files: [] };

          pathes[entry.path].__files.add(file);
          pathes[entry.path][entry.name] = file;

          break;

        //case L10N_TOKEN:
        case 'basis.l10n.getToken1':
          if (args.length == 1 && args[0][0] == 'string')
          {
            fconsole.log('[FOUND] getToken ' + args[0][1]);

            file.hasL10n = true;
            getTokenList.push({
              args: args,
              file: file
            });
          }
          // else
          // {
          //   fconsole.log('[FOUND] getToken ' + JSON.stringify(args));
          //   if (args.length > 1)
          //   {
          //     token[2] = [args.reduce(function(res, item){
          //       if (!res.length)
          //         res = item;
          //       else
          //       {
          //         if (item[0] == 'string')
          //           item[1] = '.' + item[1];
          //         else
          //           if (res[0] == 'string')
          //             res[1] = res[1] + '.';
          //           else
          //             res = ['binary', '+', res, ['string', '.']];
          //         res = ['binary', '+', res, item];
          //       }
          //       return res;
          //     }, [])];
          //     fconsole.log('replace for ' + JSON.stringify(token[2]));
          //   }
            //return token;
          }
          break;

        case 'basis.l10n.setCultureList1':
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
            list.forEach(cultureList.add, cultureList);
          }
          else
          {
            fconsole.log('        [!] Can\'t convert into array (ignored)');
          }

          break;
      }
    }
  });
}*/