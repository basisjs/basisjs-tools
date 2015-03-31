/*
  Analyse ast, create scopes
*/

var walker = require('./walker').ast_walker();
var primitive = ['true', 'false', 'null'];

var fnWalker = function(token){
  var name = token[1];
  var args = token[2];

  if (name)
    this.scope.put(name, 'defun', token, token.start);

  var scope = new Scope('function', this.scope);
  this.scopes.push(scope);

  scope.put('arguments', 'readonly');
  for (var i = 0; i < args.length; i++)
    scope.put(args[i], 'arg', null, args.loc && args.loc[i]);

  token.scope = scope;
};

var varWalker = function(token){
  var defs = token[1];

  for (var i = 0, def; def = defs[i]; i++)
  {
    var name = def[0];
    var val = def[1];

    this.scope.put(name, 'var', val, def.start);
  }
};


//
// main function
//

function process(ast, scope){
  ast.scope = scope;
  ast.names = [];
  ast.scopes = [];

  return walker.walk(ast, {
    'var': varWalker,
    'const': varWalker,
    'defun': fnWalker,
    'function': fnWalker,

    'try': function(token){
      if (token[2])
      {
        var scope = new Scope('catch', this.scope);
        this.scopes.push(scope);

        scope.put(token[2][0], 'catch');
        token[2][1].scope = scope;
      }
    },
    'name': function(token){
      if (primitive.indexOf(token[1]) == -1)
      {
        token.scope = this.scope;
        this.names.push(token);
      }
    }
  }, {
    names: ast.names,
    scopes: ast.scopes
  });
}


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
    var Names = function(){};
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
  put: function(name, type, token, loc){
    var cur = this.get(name);

    if (cur && type == 'defun')
      return;

    var ref = [type, token];
    ref.token = token || null;
    ref.loc = loc || null;

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
// export
//

module.exports = {
  Scope: Scope,
  process: process
};
