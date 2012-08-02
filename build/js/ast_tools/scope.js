/*
  Analyse ast, create scopes
*/

//
// Scope class
//

function Scope(type, parentScope, thisObject){
  this.type = type || 'unknown';
  this.thisObject = thisObject;
  this.subscopes = [];

  if (parentScope)
  {
    this.parent = parentScope;
    this.root = parentScope.root;
    parentScope.subscopes.push(this);
  }
  else
  {
    this.root = this;
  }

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
  root: null,
  parent: null,
  subscopes: null,
  thisObject: null,
  names: null,

  getNames: function(){
    var result = {};

    for (var name in this.names)
      result[name] = this.names[name];

    return result;
  },
  scopeByName: function(name){
    if (name in this.names)
    {
      var cursor = this;
      while (cursor)
      {
        if (cursor.names.hasOwnProperty(name))
          return cursor;

        cursor = cursor.parent;
      }
    }
  },
  has: function(name){
    return !!this.scopeByName(name);
  },
  hasOwn: function(name){
    return this.names.hasOwnProperty(name);
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

    var ref = [type, token];
    ref.token = token || null;

    this.names[name] = ref;

    return ref;
  },
  set: function(name, token){
    var scope = this.scopeByName(name);
    if (scope)
    {
      var ref = scope.names[name];
      ref[1] = token;
      ref.token = token;
    }
  },

  resolve: function(token){
    var path = [];
    var cursor = token;

    cycle: while (cursor && !cursor.obj)
    {
      switch (cursor[0])
      {
        case 'name':
          var nameScope = this.scopeByName(cursor[1]);

          if (!nameScope)
            return;

          if (nameScope === this)
            cursor = this.names[cursor[1]].token;
          else
            cursor = nameScope.resolve(cursor);

          break cycle;

        case 'dot':
          path.unshift(cursor[2]);
          cursor = cursor[1];
          break;

        case 'sub':
          //debugger;
          var val = this.resolve(cursor[2]);
          if (val && (val[0] == 'string' || val[0] == 'num'))
          {
            //console.log('sub', val[1], cursor);
            path.unshift(val[1]);
          }
          else
            return;

          cursor = cursor[1];

          break;

        case 'string':
        case 'num':
        case 'regexp':
        case 'defun':
        case 'function':
        case 'object':
        case 'array':
          break cycle;

        default:
          return;
      }
    }

    if (cursor && path.length)
    {
      if (!cursor.obj)
        return;

      for (var i = 0, key; key = path[i]; i++)
        if (cursor.obj && key in cursor.obj && cursor.obj[key])
          cursor = cursor.obj[key];
        else
          return;
    }

    return cursor;
  },

  isLocal: function(name){
    return this.names.hasOwnProperty(name);
  },
  isSpecial: function(name){
    name = this.get(name);
    return name && name.type == 'special';
  },
  isGlobal: function(name){
    return this.has(name) && this.get(name) === this.root.get(name);
  }
};


//
// Main function
//

var walker = require('./walker').ast_walker();
var runFunction = require('./structure').process;

function process(ast, scope){
  //
  // walkers
  //

  /*function createRunner(func){
    return function(token, t, args){
      var oldScope = func.scope;
      func.scope = new Scope('', oldScope);

      func.scope.put('arguments', 'sys', ['array', args]);
      for (var i = 0, params = func[2]; param = params[i]; i++)
        func.scope.put(param, 'arg', args[i]);

      debugger;
      runFunction(func);

      func.scope = oldScope;
    }
  }*/
  /*function createRun(fn, name){
    var result = ['function', name || null, []];
    result.run = fn;
    return result;
  }

  var objectProto = {
    hasOwnProperty: createRun(function(token, t, args){
      var res = Object.prototype.hasOwnProperty.call(t.obj, args[0].obj);
      token.obj = ['name', res ? 'true' : 'false'];
    }, 'hasOwnProperty'),
    self: createRun(function(token, t, args){
      token.obj = t.obj;
    }, 'self')
  };

  function createObj(proto){
    var F = Function();
    F.prototype = proto;
    return new F;
  }*/


  var fn_walker = function(token){
    var name = token[1];
    var args = token[2];

    if (name)
      this.scope.put(name, 'defun', token);

    var scope = new Scope('function', this.scope);
    for (var i = 0; i < args.length; i++)
      scope.put(args[i], 'arg');

    token.scope = scope;
    /*if (name)
      token.run = createRunner(token);*/
  }

  var var_walker = function(token){
    var defs = token[1];

    for (var i = 0, def; def = defs[i]; i++)
    {
      var name = def[0];
      var val = def[1];

      if (val)
        val = this.walk(def, 1);

      this.scope.put(name, 'var', val);
    }

    return token;
  }

  //
  // main part
  //

  ast.scope = scope;

  return walker.walk(ast, {
    'var': var_walker,
    'const': var_walker,
    'defun': fn_walker,
    'function': fn_walker,

    /*'object': function(token){
      console.log('!');
      token.obj = createObj(objectProto);
      for (var i = 0, props = token[1], prop; prop = props[i]; i++)
        token.obj[prop[0]] = prop[1];
    },
    'string': function(token){
      token.obj = token[1];
    },*/

    /*
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

    },*/

    assign: function(token){
      var op = token[1];
      var lvalue = token[2];
      var rvalue = this.walk(token, 3);

      if (lvalue[0] == 'name')
        this.scope.set(lvalue[1], 'assign', rvalue);
      else
        this.walk(token, 2);

      return token;
    }
  });
}


module.exports = {
  Scope: Scope,
  process: process
};
