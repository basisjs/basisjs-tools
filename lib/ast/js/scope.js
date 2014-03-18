/*
  Analyse ast, create scopes
*/

var hasOwnProperty = Object.prototype.hasOwnProperty;

//
// Scope class
//

function Scope(type, parentScope, thisObject){
  this.type = type || 'unknown';
  this.thisObject = thisObject || ['name', 'undefined'];
  this.subscopes = [];

  if (parentScope)
  {
    this.level = parentScope.level + 1;
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

  this.put('this', 'readonly', this.thisObject);
}

Scope.prototype = {
  root: null,
  parent: null,
  subscopes: null,
  thisObject: null,
  names: null,
  level: 1,

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
        if (hasOwnProperty.call(cursor.names, name)) // hasOwnProperty may be overriden
          return cursor;

        cursor = cursor.parent;
      }
    }
  },
  has: function(name){
    return !!this.scopeByName(name);
  },
  hasOwn: function(name){
    return hasOwnProperty.call(this.names, name);
  },
  get: function(name){
    if (this.has(name))
      return this.names[name];
  },
  token: function(name){
    var ref = this.get(name);
    return ref && ref.token;
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

    if (cursor.obj && cursor.ref_)
      return cursor.ref_;

    cycle:
    while (cursor && !cursor.obj)
    {
      switch (cursor[0])
      {
        case 'name':
          if (cursor[1] == 'this')
          {
            cursor = (cursor.scope || this).thisObject;  // FIXME: it seems a hack, remove cursor.scope - thisObject always must be of current scope
            break cycle;
          }

          var nameScope = cursor.scope || this.scopeByName(cursor[1]);

          if (!nameScope)
            return;

          if (nameScope === this)
          {
            cursor = this.names[cursor[1]];
            if (cursor)
              cursor = cursor.token;
          }
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

        case 'call':
          cursor = cursor.ref_;
          break;

        default:
          return;
      }
    }

    if (cursor && path.length)
    {
      if (cursor.ref_)
        cursor = cursor.ref_;

      if (!cursor.obj)
        return;

      for (var i = 0, key; key = path[i]; i++)
        if (cursor.obj && key in cursor.obj && cursor.obj[key])
        {
          cursor = cursor.obj[key];
          if (cursor.ref_)
           cursor = cursor.ref_;
        }
        else
          return;
    }

    return cursor;
  },

  deepResolve: function(token){
    var prev;
    do
    {
      prev = token;
      token = this.resolve(token);
    }
    while (token && token !== prev);

    return token;
  },
  simpleExpression: function(token){
    switch (token[0])
    {
      case 'binary':
        if (token[1] == '+')
        {
          var left = this.simpleExpression(token[2]);
          var right = this.simpleExpression(token[3]);
          if (left && left[0] == 'string' && right && right[0] == 'string')
            return ['string', left[1] + right[1]];
        }
        break;
      default:
        return this.deepResolve(token);
    }
  },

  isLocal: function(name){
    return hasOwnProperty.call(this.names, name);
  },
  isSpecial: function(name){
    name = this.get(name);
    return name && name.type == 'special';
  },
  isGlobal: function(name){
    var entry = this.get(name);
    return entry && ((entry.token && entry.token.scope && entry.token.scope == this.root) || entry === this.root.get(name));
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
  };

  var var_walker = function(token){
    var defs = token[1];

    for (var i = 0, def; def = defs[i]; i++)
    {
      var name = def[0];
      var val = def[1];

      //if (val)
      //  val = this.walk(def, 1);

      this.scope.put(name, 'var', val);
    }

    //return token;
  };

  //
  // main part
  //

  ast.scope = scope;
  ast.throws = [];

  walker.walk(ast, {
    '*': function(token){
      token.in_code = true;
    }
  });

  return walker.walk(ast, {
    'throw': function(token){
      ast.throws.push(token);
    },

    'var': var_walker,
    'const': var_walker,
    'defun': fn_walker,
    'function': fn_walker,

    'name': function(token){
      token.scope = this.scope;
      //var ref = this.scope.get(token[1]);
      //return (ref && ref.token) || token;
    },
    'object': function(token){
      token.obj = {};
      token.objSource = {};
      for (var i = 0, prop; prop = token[1][i]; i++)
      {
        token.obj[prop[0]] = this.scope.resolve(prop[1]) || prop[1];
        token.objSource[prop[0]] = token;
      }
    },

    'assign': function(token){
      var op = token[1];
      var lvalue = token[2];
      var rvalue = this.walk(token, 3);

      if (op === true && lvalue[0] == 'name')
        this.scope.set(lvalue[1], rvalue);
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
