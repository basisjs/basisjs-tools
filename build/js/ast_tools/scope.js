/*
  Analyse ast, create scopes
*/


//
// Scope class
//

function Scope(type, parentScope, thisObject){
  this.type = type || 'unknown';
  this.parent = parentScope;
  this.root = parentScope ? parentScope.root : this;
  this.thisObject = thisObject;

  if (parentScope)
  {
    var Names = Function();
    Names.prototype = parentScope.names;
    this.names = new Names();
  }
  else
    this.names = {};
}

Scope.prototype = {
  getNames: function(){
    var result = {};

    for (var name in this.names)
      result[name] = this.names[name];

    return result;
  },
  has: function(name){
    return this.names.hasOwnProperty(name) || (this.parent && this.parent.has(name));
  },
  get: function(name){
    if (this.has(name))
      return this.names[name];
  },
  put: function(name, type, token){
    var cur = this.get(name);

    if (cur)
    {
      if (type == 'defun')
        return;
    }

    this.names[name] = [type, token];

    return this.names[name];
  },
  isSpecial: function(name){
    name = this.get(name);
    return name && name.type == 'special';
  },
  isRoot: function(name){
    return [].indexOf(name) != -1 && (!this.has(name) || this.isSpecial(name));
  },
  isGlobal: function(name){
    return this.has(name) && this.get(name) === this.root.get(name);
  }
};


//
// Main function
//

var walker = require('./walker').ast_walker();

function process(ast, scope){
  //
  // walkers
  //

  var fn_walker = function(token){
    var name = token[1];
    var args = token[2];

    if (name)
      this.scope.put(name, 'defun');

    var scope = new Scope('function', this.scope);
    for (var i = 0; i < args.length; i++)
      scope.put(args[i], 'arg');

    token.scope = scope;
  }

  var var_walker = function(token){
    var defs = token[1];
    for (var i = 0, def; def = defs[i]; i++)
    {
      var name = def[0];
      var val = def[1];

      if (val)
      {
        val = this.walk(val);
        defs[i][1] = val;
      }

      this.scope.put(name, 'var');
    }

    return token;
  }

  //
  // main part
  //

  //var walkerStack = walker.stack;
  ast.scope = scope;

  return walker.walk(ast, {
    'var': var_walker,
    'const': var_walker,
    'defun': fn_walker,
    'function': fn_walker/*,

    name: function(token){
      var name = token[1];

      var ret = scope.has(name) && scope.get(name)[1];

      if (ret && resolveNameRef(ret)[0] != name)
      {
        // TODO: check for name conflict, it base name not in scope
        token.splice.apply(token, [0, token.length].concat(ret));
        return;
      }

      if (scope.isRoot(name))
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
    },

    'call': function(token){

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
        }
      }

      return token;
    }*/
  });
}


module.exports = {
  Scope: Scope,
  process: process
};
