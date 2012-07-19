
module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  flow.l10n = {
    cultureList: [],  // TODO: fetch culture list from basis.l10n
    defList: [],
    getTokenList: [],
    packages: [],
    pathes: {}
  };


  //
  // Scan javascript for l10n
  //

  fconsole.start('Scan javascript');
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'script')
    {
      // scan file for basis.l10n.createDictionary & basis.l10n.setCultureList
      fconsole.start(file.filename ? file.relpath : '[inline script]');

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
  fconsole.endl();

  //
  // Add dictionary files
  //

  fconsole.start('Fetch dictionary files');
  for (var path in flow.l10n.pathes)
  {
    var entryList = flow.l10n.pathes[path];

    fconsole.start(reldir(flow, path));
    for (var i = 0; culture = flow.l10n.cultureList[i]; i++)
    {
      var dictFile = flow.files.add({
        filename: path + '/' + culture + '.json',
        type: 'l10n',
        culture: culture
      })

      entryList.__files.forEach(function(file){
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
var at = require('../js/ast_tools');
var CREATE_DICTIONARY = at.normalize('basis.l10n.createDictionary');
var GET_TOKEN = at.normalize('basis.l10n.getToken');
var SET_CULTURE_LIST = at.normalize('basis.l10n.setCultureList');

function reldir(flow, dir){
  return path.relative(flow.options.base, dir).replace(/\\/g, '/') + '/';
}

function scanFile(file, flow){
  var context = flow.js.getFileContext(file);
  var fconsole = flow.console;
  var defList = flow.l10n.defList;
  var getTokenList = flow.l10n.getTokenList;
  var pathes = flow.l10n.pathes;

  at.walk(file.ast, {
    call: function(expr, args){
      switch (at.translate(expr))
      {
        case CREATE_DICTIONARY:
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
        case GET_TOKEN:
          if (args.length == 1 && args[0][0] == 'string')
          {
            fconsole.log('[FOUND] getToken ' + args[0][1]);

            file.hasL10n = true;
            getTokenList.push({
              args: args,
              file: file
            });
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
            list.forEach(flow.l10n.cultureList.add, flow.l10n.cultureList);
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