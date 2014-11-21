var processor = require('uglify-js').uglify;

var refs = require('./ref');

var Symbol = refs.Symbol;
var ObjectSymbol = refs.ObjectSymbol;
var ObjectExportSymbol = refs.ObjectExportSymbol;
var AssignExportSymbol = refs.AssignExportSymbol;

var throwIdx = 0;

function resolveCodePath(map, path, refName){
  var parts = path.split('.');
  var paths = [];

  for (var i = parts.length - 2; i >= 1; i--)
    paths.push(map[parts.slice(0, i + 1).join('.')]);

  var refs = map[path];

  if (!refs)
    return;

  for (var i = 0, ref; ref = refs[i]; i++)
  {
    var cursor = ref.splice(0, ref.length, 'name', refName)[1];

    for (var j = 0, ar; ar = paths[j]; j++)
    {
      ar.splice(ar.indexOf(cursor), 1);
      cursor = cursor[1];
    }
  }

  delete map[path];
}

////////////////////////

function process(ast, walker, rootNames, refMap, exportMap, namespace){
  var SPECIALS = ['basis', 'global', '__filename', '__dirname', 'resource', 'module', 'exports'];

  var walkerStack = walker.stack;
  var messages = [];
  var throwCodes = [];

  var code_exports = {};
  var code_refs = refMap || {};

  var rootScope = {};
  var scope = rootScope;
  var scopes = [];

  SPECIALS.forEach(function(name){
    putScope(rootScope, name, 'special');
  });

  function warn(message){
    messages.push({
      type: 'WARN',
      text: message
    });
  }
  function msg(message){
    messages.push({
      text: message
    });
  }

  function newScope(){
    var F = Function();
    F.prototype = scope;
    scopes.push(scope);
    return new F();
  }

  function restoreScope(){
    scope = scopes.pop();
  }

  function putScope(scope, name, type, nameReplace, token){
    var cur = scope[type];

    if (cur)
    {
      if (type == 'defun')
        return;
    }

    if (nameReplace)
    {
      var rname = resolveName(nameReplace);
                               // TODO: use only export paths
      if (!isRoot(rname[0]) || rname.indexOf('prototype') != -1)
        nameReplace = undefined;
    }

    scope[name] = [type, nameReplace, token];

    //if (token && rname.length == 1 && scope[rname[0]] && scope[rname[0]].isClass)
    //  scope[name].isClass = true;
  }

  function showScope(){
    var result = {};

    for (var key in scope)
      result[key] = scope[key];

    return result;
  }

  function walkEach(context, array){
    for (var i = 0, len = array.length; i < len; i++)
      array[i] = context.walk(array[i]);
  }

  function isReserved(name){
    return name == 'this' || name == 'false' || name == 'true' || name == 'null' || name == 'undefined';
  }

  function isSpecial(name){
    return scope[name] && scope[name][0] == 'special';
  }

  function isRoot(name){
    return rootNames.indexOf(name) != -1 && (!scope.hasOwnProperty(name) || isSpecial(name));
  }

  function resolveName(token, asString){
    var result;
    if (token)
      switch (token[0])
      {
        case 'dot':
          var res = resolveName(token[1]);

          if (res)
            result = res.concat(token[2]);

          break;
        case 'name':
          result = [token[1]];
      }

    if (result && asString)
      return result.join('.');

    return result;
  }

  function resolveNameRef(token){
    var res = resolveName(token);
    if (res && !isReserved(res[0]))
      return res;
  }

  var fn_walker = function(token){
    var name = token[1];
    var args = token[2];
    var body = token[3];

    if (name)
      putScope(scope, name, 'defun');

    var ast_fragment = ['block', body];
    fnqueue.push(ast_fragment);

    ast_fragment.scope = newScope();
    for (var i = 0; i < args.length; i++)
      putScope(ast_fragment.scope, args[i], 'arg');

    return token;
  };

  var var_walker = function(token){
    var defs = token[1];
    for (var i = 0; i < defs.length; i++)
    {
      var val = defs[i][1];

      if (val)
      {
        val = this.walk(val);
        defs[i][1] = val;
      }

      putScope(scope, defs[i][0], 'var', resolveNameRef(val) && val, val);

      if (val)
        scope[defs[i][0]].classDef = isClassConstructor(val);
    }

    return token;
  };

  function putCodePath(path, token){
    if (!code_refs[path])
      code_refs[path] = [];

    code_refs[path].push(token);
  }

  function extendExports(token, namespace){
    if (token[0] == 'object')
    {
      for (var i = 0, props = token[1]; i < props.length; i++)
      {
        var sym = new ObjectExportSymbol(token, props[i]);
        if (namespace)
          sym.namespace = namespace;
        code_exports[props[i][0]] = sym;
      }
    }
  }

  function getClassDef(pn, global){
    if (pn.length == 1)
    {
      //console.log(pn, scope[pn[0]] && scope[pn[0]].isClass);
      return scope[pn[0]] && scope[pn[0]].classDef;
    }

    //console.log('Check:', pn.join('.'), classMap.hasOwnProperty(pn.join('.')));
    return global && exportMap.hasOwnProperty(pn.join('.'));
  }

  function isClassConstructor(token){
    if (token.isClassDef)
      return token;

    if (token[0] == 'name')
      return scope[token[1]] && scope[token[1]].classDef;

    if (token[0] == 'call')
    {
      //console.log(name, token);
      var re = resolveName(token[1]);
      if (re)
      {
        var isClass = re[re.length - 1] == 'subclass' && getClassDef(re.slice(0, re.length - 1), true);
                      // re.pop() == 'subclass' && getClassDef(re, true);

        if (isClass)
        {
          // class.subclass(..) -> basis.Class(class, ...)
          token[2].unshift(token[1][1]);
          token[1] = ['dot', ['name', 'basis'], 'Class'];
        }
        else
        {
          var path = isSpecial(re[0]) && re.join('.');
          isClass = path && (path == 'basis.Class' || path == 'basis.Class.create');
        }

        if (isClass)
        {

          token.refCount = 0;
          token.isClassDef = true;

          for (var i = 0, args = token[2], arg; arg = args[i]; i++)
          {
            if (arg[0] == 'object')
            {
              for (var j = 0, props = arg[1], prop; prop = props[j]; j++)
                if (prop[0] == 'className')
                {
                  props.splice(j, 1);
                  break;
                }
            }
          }

          return token;
        }
      }
    }
  }

  function resolveValue(cursor){
    while (cursor && cursor[0] == 'name')
      cursor = scope[cursor[1]] && scope[cursor[1]][2];
    return cursor;
  }

  function isNamespace(token){
    if (token.isNamespace)
      return token.isNamespace;

    if (namespace != 'basis' && scope === rootScope && token[0] == 'name' && token[1] == 'this')
      return namespace;

    if (token[0] == 'name')
    {
      var rv = resolveValue(token);
      if (rv)
        return isNamespace(rv);
    }

    if (token[0] == 'call')
    {
      var rn = resolveName(token[1]);
      if (rn)
      {
        var path = rn.join('.');
        if ((path == 'basis.namespace' && isSpecial(rn[0])) || (namespace == 'basis' && path == 'getNamespace'))
        {
          var rv = resolveValue(token[2][0]);
          if (rv[0] == 'string')
          {
            token.isNamespace = rv[1];
            console.log('FOUND: ', token.isNamespace);
            return token.isNamespace;
          }
        }
      }
    }
  }

  var fnqueue = [ast];
  var ast_fragment;

  while (ast_fragment = fnqueue.pop())
  {
    if (ast_fragment.scope)
    {
      scopes.push(scope);
      scope = ast_fragment.scope;
    }

    walker.walk(ast_fragment, {
      'var': var_walker,
      'const': var_walker,
      'defun': fn_walker,
      'function': fn_walker,

      'throw': function(token){
        throwCodes.push([++throwIdx, token.slice()]);
        token[1] = ['num', throwIdx];
      },

      'dot': function(token){
        if (namespace && scope == rootScope && token[2] == 'path' && resolveName(token[1], true) == 'this')
          return ['string', namespace];
      },

      name: function(token){
        var name = token[1];

        if (name == 'this' && namespace && scope == rootScope)
        {
          var topToken = walkerStack[walkerStack.length - 2];
          if (topToken[0] == 'dot' && topToken[1] == 'path')
          {
            console.log('>>>>', topToken);
            topToken.splice(0, topToken.length, 'string', namespace);
            return token;
          }
        }

        var ret = scope[name] && scope[name][1];

        if (ret && resolveNameRef(ret) && resolveNameRef(ret)[0] != name)
        {
          // TODO: check for name conflict, it base name not in scope
          token.splice.apply(token, [0, token.length].concat(ret));
          return;
        }

        //name = this.token[1];
        if (isRoot(name))
        {
          var pos = walkerStack.length - 1;
          var path = [name];
          var cursor;
          while (cursor = walkerStack[--pos])
          {
            if (cursor[0] != 'dot')
              break;

            path.push(cursor[2]);
            putCodePath(path.join('.'), cursor);
          }
        }
        else
        {
          var classDef = getClassDef([name]);
          if (classDef)
          {
            classDef.refCount++;
            token.classDef = classDef;
            /*if (name=='RuleSet'){
              console.log(walkerStack.map(function(f){return f[0]}).join('->'))
              if (walkerStack[0][0] != 'toplevel')
                console.log(processor.gen_code(walkerStack[0]));
            };*/
          }
        }

        //return this;
      },

      'call': function(token){
         var expr = token[1];
         var args = token[2];

         if (expr[0] == 'dot' && expr[2] == 'extend')
         {
           var ns = isNamespace(expr[1]);
           if (ns)
           {
             if (namespace != 'basis')
               warn('this.extend call is prohibited for export. Use module.exports instead.');
             extendExports(args[0], ns);
           }
         }
         else/*
         var name = resolveName(expr);
         if (name && name.join('.') == 'this.extend' && scope === rootScope)
         {
           warn('this.extend call is prohibited for export. Use module.exports instead.');
           extendExports(args[0]);
         }
         else*/
         {
           token.isClassDef = !!isClassConstructor(token);
         }
      },

      'assign': function(token){
        var op = token[1];
        var lvalue = token[2];
        var rvalue = token[3];

        rvalue = this.walk(rvalue);
        token[3] = rvalue;

        if (op === true)
        {
          if (lvalue[0] == 'name')
          {
            putScope(scope, lvalue[1], 'var', resolveNameRef(rvalue) && rvalue);
            scope[lvalue[1]].classDef = isClassConstructor(rvalue);
          }
          else
          {
            var pn = resolveNameRef(lvalue);

            if (pn && isSpecial(pn[0]))
            {
              //console.log('!!!!!!FOUND', this);
              switch (pn[0]){
                case 'exports':
                  if (pn.length == 2)
                    code_exports[pn[1]] = new AssignExportSymbol(token, rvalue);
                  break;
                case 'module':
                  if (pn[1] == 'exports')
                  {
                    if (pn.length == 2)
                    {
                      if (Object.keys(code_exports).length)
                      {
                        warn('module.exports reset some export keys. Probably dead code found.');

                        for (var key in code_exports)
                        {
                          var token = code_exports[key][0];
                          token.splice(0, token.length, 'block');
                        }
                      }

                      code_exports = {};
                      extendExports(rvalue, namespace);
                    }
                    else
                    {
                      if (pn.length == 3)
                        code_exports[pn[2]] = new AssignExportSymbol(token, rvalue);
                    }
                  }
                  break;
              }
            }
            else
              return;
          }
        }

        return token;
      }
    });

    if (ast_fragment.scope)
      scope = scopes.pop();
  }

  if (namespace)
  {
    for (var key in code_exports)
    {
      if (code_exports.hasOwnProperty(key))
      {
        var token = code_exports[key].token;
        var ref = code_exports[key].ref;
        var classDef = scope[key] && scope[key].classDef;

        if (!classDef)
          classDef = isClassConstructor(token[0] == 'object' ? ref[1] : ref);

        code_exports[key].classDef = classDef;

        //
        //
        //

        var exportEntry = code_exports[key];
        var name = (exportEntry.namespace || namespace) + '.' + key;

        if (exportMap.hasOwnProperty(name))
          warn('Export map already contains ' + name);

        var rv = resolveValue(token[0] == 'object' ? ref[1] : ref);

        switch (rv && rv[0])
        {
          case 'object':

            break;

          case 'num':
          case 'string':
            //exportMap[name] = new Symbol(cursor);
            //msg('[+] Add export symbol ' + name + ' (' + cursor[0] + ')');
            exportEntry.constRef = rv;
            break;
        }

        exportMap[name] = exportEntry;
        msg('[+] Add export symbol ' + name + (classDef ? ' (Class)' : ''));

        /*if (/^[A-Z\_]+$/.test(key) && rv)
          console.log(key, rv[0]);*/
        /*switch(exportEntry[0]){
          case 'number':
          case 'string':
            exportEntry.constant = exportEntry[]
        }*/
      }
    }
  }
  else
    code_exports = {};

  return {
    ast: ast,
    refs: code_refs,
    exports: code_exports,
    messages: messages.length ? messages : false,
    throwCodes: throwCodes
  };
}

module.exports = {
  process: process,
  resolve: resolveCodePath
};
