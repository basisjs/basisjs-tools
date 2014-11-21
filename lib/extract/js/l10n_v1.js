var at = require('../../ast').js;
var path = require('path');
var l10nContext = require('../l10n/context.js');

function reldir(flow, dir){
  return path.relative(flow.options.base, dir).replace(/\\/g, '/') + '/';  // [base]
}

//
// OLD API
//
module.exports = function(file, flow, defineHandler, globalScope){
  var fconsole = flow.console;
  var defList = flow.l10n.defList;
  var getTokenList = flow.l10n.getTokenList;
  var paths = flow.l10n.paths;
  var cultureList = flow.l10n.cultureList;

  flow.l10n = {
    version: 1,
    module: file,
    cultureList: [],  // TODO: fetch culture list from basis.l10n
    defList: [],
    getTokenList: [],
    paths: {},
    tokens: {},

    dictList: {}
  };

  // TODO: fetch culture list from basis.l10n
  defineHandler(globalScope, 'basis.l10n.setCultureList', function(token, this_, args){
    // FIXME: make better resolve solution
    var list = at.getCallArgs(args, this.file.context, flow, this.file)[0];

    fconsole.start('[basis.l10n] ' + at.translate(token) + ' in ' + this.file.relpath);

    if (typeof list == 'string')
      list = list.trim().split(/\s+/);

    if (Array.isArray(list))
    {
      for (var i = 0, cultureDef; cultureDef = list[i]; i++)
      {
        var clist = cultureDef.split(/\//);
        list[i] = clist[0];
      }

      fconsole.log('[OK] Set culture list ' + JSON.stringify(list));
      list.forEach(cultureList.add, cultureList);
    }
    else
    {
      flow.warn({
        file: this.file.relpath,
        message: 'basis.l10n.setCultureList is not resolved (can\'t convert into array): ' + at.translate(token)
      });
    }

    fconsole.end();
  });

  // basis.l10n.createDictionary
  defineHandler(file.jsScope, 'basis.l10n.createDictionary', function(token, this_, args){
    //fconsole.log('basis.l10n.createDictionary', args);

    // TODO: remove this kostil'
    args = args.map(this.scope.simpleExpression, this.scope);
    var name = args[0] && args[0][0] == 'string' ? args[0][1] : null;
    var dir = args[1] && args[1][0] == 'string' ? args[1][1] : null;
    var keys = args[2] && args[2][0] == 'object' ? args[2].obj : null;

    if (!name)
      return flow.warn({
        fatal: true,
        file: this.file.relpath,
        message: 'basis.l10n.createDictionary: first parameter is not resolved, token: ' + at.translate(token)
      });

    if (!dir)
      return flow.warn({
        fatal: true,
        file: this.file.relpath,
        message: 'basis.l10n.createDictionary: second parameter is not resolved, token: ' + at.translate(token)
      });

    if (!keys)
      return flow.warn({
        fatal: true,
        file: this.file.relpath,
        message: 'basis.l10n.createDictionary: third parameter is not resolved or not an object, token: ' + at.translate(token)
      });

    var keysObj = {};
    for (var key in keys)
    {
      var val = this.scope.simpleExpression(keys[key]);

      if (!val || val[0] != 'string')
        return flow.warn({
          fatal: true,
          file: this.file.relpath,
          message: 'basis.l10n.createDictionary: value is not resolved (third parameter), value: ' + at.translate(val) + ', token: ' + at.translate(token)
        });

      keysObj[key] = val[1];
    }

    // resolve to file
    dir = this.file.resolve(dir);

    var entry = {
      args: token[2],
      name: name,
      path: path.resolve(flow.options.base, dir),
      keys: keysObj,
      file: this.file
    };

    fconsole.log('[basis.l10n] createDictionary ' + entry.name + ' -> ' + reldir(flow, entry.path));

    token.l10n = entry;
    defList.push(entry);

    if (!paths[entry.path])
      paths[entry.path] = {
        __files: []
      };

    paths[entry.path].__files.add(this.file);
    paths[entry.path][entry.name] = this.file;
  });

  // basis.l10n.getToken
  defineHandler(file.jsScope, 'basis.l10n.getToken', function(token, this_, args){
    //fconsole.log('basis.l10n.getToken', args);

    var expr = args[0];
    for (var i = 1, arg; arg = args[i]; i++)
      expr = ['binary', '+', expr, ['binary', '+', ['string', '.'], arg]];

    var key = this.scope.simpleExpression(expr);
    if (key && key[0] == 'string')
    {
      fconsole.log('[basis.l10n] getToken ' + key[1]);

      var entry = {
        token: token,
        key: key[1],
        file: this.file
      };
      token.l10n = entry;
      getTokenList.push(entry);
    }
    else
    {
      // TODO: temporary solution, fix me
      if (!/^basis\.(ui|template|template\.html)$/.test(this.file.namespace))
      {
        flow.warn({
          file: this.file.relpath,
          message: 'basis.l10n.getToken is not resolved: ' + at.translate(token)
        });
      }
    }
  });
};
