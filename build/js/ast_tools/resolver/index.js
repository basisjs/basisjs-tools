
var processor = require("uglify-js").uglify;

function resolveCodePath(map, path, refName){
  var parts = path.split('.');
  var pathes = [];

  for (var i = parts.length - 2; i >= 1; i--)
    pathes.push(map[parts.slice(0, i + 1).join('.')]);

  var refs = map[path];

  if (!refs)
    return;

  for (var i = 0, ref; ref = refs[i]; i++)
  {
    var cursor = ref.splice(0, ref.length, 'name', refName)[1];

    for (var j = 0, ar; ar = pathes[j]; j++)
    {
      ar.splice(ar.indexOf(cursor), 1);
      cursor = cursor[1];
    }
  }

  delete map[path];
}


function process(ast, walker, rootNames, refMap, classMap){
  var SPECIALS = ['basis', 'global', '__filename', '__dirname', 'resource', 'module', 'exports'];

  var walkerStack = walker.stack;
  var warn = [];

  var code_exports = {};
  var code_refs = refMap || {};

  var rootScope = {};
  var scope = rootScope;
  var scopes = [];

  SPECIALS.forEach(function(name){
    putScope(rootScope, name, 'special');
  });

  function newScope(){
    var F = Function();
    F.prototype = scope;
    scopes.push(scope);
    return new F();
  }

  function restoreScope(){
    scope = scopes.pop();
  }

  function putScope(scope, name, type, token){
    var cur = scope[type];

    if (cur)
    {
      if (type == 'defun')
        return;
    }

    if (token)
    {
      var rname = resolveName(token);
                               // TODO: use only export pathes
      if (!isRoot(rname[0]) || rname.indexOf('prototype') != -1)
        token = undefined;
    }

    scope[name] = [type, token];

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

  function resolveName(token){
    if (token)
      switch (token[0])
      {
        case 'dot':
          var res = resolveName(token[1]);

          if (res)
            return res.concat(token[2]);

          break;
        case 'name':
          return [token[1]];
      }
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

    body.scope = newScope();

    for (var i = 0; i < args.length; i++)
      putScope(body.scope, args[i], 'arg');

    fnqueue.push(['block', body]);

    return token;
  }

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

      putScope(scope, defs[i][0], 'var', resolveNameRef(val) && val);

      
      if (val)
        scope[defs[i][0]].classDef = isClassConstructor(val);
    }

    return token;
  }

  function putCodePath(path, token){
    if (!code_refs[path])
      code_refs[path] = [];

    code_refs[path].push(token);
  }

  function extendExports(token){
    if (token[0] == 'object')
    {
      var props = token[1];
      for (var i = 0; i < props.length; i++)
        code_exports[props[i][0]] = [token, props[i]];
    }
  }

  function getClassDef(pn, global){
    if (pn.length == 1)
    {
      //console.log(pn, scope[pn[0]] && scope[pn[0]].isClass);
      return scope[pn[0]] && scope[pn[0]].classDef;
    }

    //console.log('Check:', pn.join('.'), classMap.hasOwnProperty(pn.join('.')));
    return global && classMap.hasOwnProperty(pn.join('.'));
  }

global.classDefRef = {};
  function isClassConstructor(expr){
    if (expr[0] == 'name')
      return scope[expr[1]] && scope[expr[1]].classDef;

    if (expr[0] == 'call')
    {
      //console.log(name, expr);
      var re = resolveName(expr[1]);
      if (re)
      {
        if (re[re.length - 1] == 'subclass' && getClassDef(re.slice(0, re.length - 1), true))
        {
          expr.refCount = 0;
          return expr;
        }

        var path = isSpecial(re[0]) && re.join('.');
        if (path && (path == 'basis.Class' || path == 'basis.Class.create'))
        {
          expr.refCount = 0;
          return expr;
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

      name: function(token){
        var name = token[1];
        var ret = scope[name] && scope[name][1];

        if (ret && resolveNameRef(ret)[0] != name)
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
            if (name=='RuleSet'){
              console.log(walkerStack.map(function(f){return f[0]}).join('->'))
              if (walkerStack[0][0] != 'toplevel')
                console.log(processor.gen_code(walkerStack[0]));
            };
          }
        }

        //return this;
      },

      'call': function(token){
         var expr = token[1];
         var args = token[2];

         var name = resolveName(expr);
         if (name && name.join('.') == 'this.extend' && scope === rootScope)
         {
           warn.push('this.extend call is prohibited for export. Use module.exports instead.');
           extendExports(args[0]);
         }
      },

      assign: function(token){
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
                    code_exports[pn[1]] = [token, rvalue];
                  break;
                case 'module':
                  if (pn[1] == 'exports')
                  {
                    if (pn.length == 2)
                    {
                      if (Object.keys(code_exports).length)
                      {
                        warn.push('module.exports reset some export keys. Probably dead code found.');
                        for (var key in code_exports)
                        {
                          var token = code_exports[key][0];
                          token.splice(0, token.length, 'block');
                        }
                      }

                      code_exports = {};
                      extendExports(rvalue);
                    }
                    else
                    {
                      if (pn.length == 3)
                        code_exports[pn[2]] = [token, rvalue];
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

  for (var key in code_exports)
    if (code_exports.hasOwnProperty(key))
    {
      var classDef = scope[key] && scope[key].classDef;

      if (!classDef)
      {
        var token = code_exports[key][0];
        var ref = code_exports[key][1];
        classDef = isClassConstructor(token[0] == 'object' ? ref[1] : ref);
      }

      code_exports[key].classDef = classDef;
    }

  return {
    ast: ast,
    refs: code_refs,
    exports: code_exports,
    warn: warn.length ? warn : false
  }
}

module.exports = {
  process: process,
  resolve: resolveCodePath
};
