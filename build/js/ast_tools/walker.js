
var processor = require("uglify-js").uglify;

function slice(a, start) {
  return Array.prototype.slice.call(a, start || 0);
};

function HOP(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

/*
var MAP = (function(){
  var AtTop = function(val){
    this.v = val;
  };
  var Splice = function(val){
    this.v = val;
  };
  var skip = {};

  var MAP = function(obj, fn, context){
    var ret = [];
    var top = [];

    callCount['MAP']++;

    function doit(item, index){
      var val = fn.call(context, item, index);

      if (val === skip)
        return;

      var target = ret;
      if (val instanceof AtTop)
      {
        val = val.v;
        target = top;
      }

      if (val instanceof Splice)
        target.push.apply(target, val.v);
      else
        target.push(val);
    }

    obj.forEach(doit);

    return top.length ? top.concat(ret) : ret;
  };

  MAP.at_top = function(val){
    return new AtTop(val);
  };
  MAP.splice = function(val){
    return new Splice(val);
  };
  MAP.skip = skip;

  return MAP;
})();*/


var callCount = { MAP: 0, EACH: 0, walk: 0, 'walk(null)': 0 };
global.callCount = callCount;
function count(name, fn){
  return fn;
  callCount[name] = 0;
  return function(){
    callCount[name]++;
    return fn.apply(this, arguments);
  }
}

function $self(){
  return slice(arguments);
}

var MAP = count('MAP', function(array, fn, context){
  for (var i = 0, len = array.length; i < len; i++)
    array[i] = fn.call(context, array[i]);
});

var EACH = count('EACH', function(array, fn, context){
  for (var i = 0, len = array.length; i < len; i++)
    fn.call(context, array[i]);
});

var walkEach = count('walkEach', function(context, array){
  for (var i = 0, len = array.length; i < len; i++)
    array[i] = context.walk(array[i]);
});



function overrideObject(obj, props){
  var old = {};
  for (var key in props)
    if (props.hasOwnProperty(key))
    {
      if (obj.hasOwnProperty(key))
        old[key] = obj[key];

      obj[key] = props[key];
    }
  return old;
}

function restoreObject(obj, props, old){
  for (var key in props)
    if (props.hasOwnProperty(key))
    {
      if (old.hasOwnProperty(key))
        obj[key] = old[key];
      else
        delete obj[key];
    }
}


function ast_walker(){
  function _vardefs(token){ // type, defs
    /*return [
      type,
      MAP(defs, function(def){
        var a = [def[0]];
        if (def.length > 1) a[1] = this.walk(def[1]);
        return a;
      }, this)
    ];*/

    EACH(token[1], function(def){ // defs
      if (def[1]) def[1] = this.walk(def[1]);
    }, this);
  };

  function _block(token){ // type, statements
    /*var out = [type];
    if (statements != null) out.push(MAP(statements, walk, this));
    return out;*/
    if (token[1])  // statements
      //MAP(token[1], walk, this);
      walkEach(this, token[1]);
  };

  var defWalkers = {
    "toplevel": function(token){ // type, statements
      //return [type, MAP(statements, walk, this)];

      //MAP(token[1], walk, this);  // statements
      walkEach(this, token[1]);
    },
    "array": function(token){ // type, elements
      // return [type, MAP(elements, walk, this)];

      //MAP(token[1], walk, this); // elements
      walkEach(this, token[1]);
    },

    "debugger": $self, //function(type){ return [type]; },
    "string": $self, // function(str){ return [type, str]; },
    "num": $self, // function(num){ return [type, num]; },
    "name": $self, // function(name){ return [type, name]; },
    "break": $self, // function(label){ return [type, label]; },
    "continue": $self, // function(label){ return [type, label]; },
    "regexp": $self, // function(rx, mods){ return [type, rx, mods]; },
    "atom": $self, // function(name){ return [type, name]; },
    "directive": $self, // function(dir){ return [type, dir]; }

    "block": _block,
    "splice": _block,

    "var": _vardefs,
    "const": _vardefs,

    "try": function(token){ // type, try_, catch_, finally_
      /*return [
        type,
        MAP(try_, walk, this),
        catch_ && [catch_[0], MAP(catch_[1], walk, this)],
        finally_ && MAP(finally_, walk, this)
      ];*/

      //MAP(token[1], walk, this); // try_
      walkEach(this, token[1]);

      if (token[2]) // catch_
        //MAP(token[2][1], walk, this);
        walkEach(this, token[2][1]);

      if (token[3]) // finally_
        //MAP(token[3], walk, this);
        walkEach(this, token[3]);
    },
    "new": function(token){ // type, ctor, args
      //return [type, this.walk(ctor), MAP(args, walk, this)];

      token[1] = this.walk(token[1]); // ctor
      //MAP(token[2], walk, this); // args
      walkEach(this, token[2]);
    },
    "switch": function(token){ // type, expr, body
      /*return [
        type,
        this.walk(expr),
        MAP(body, function(branch){
          return [
            branch[0] ? this.walk(branch[0]) : null,
            MAP(branch[1], walk, this)
          ];
        }, this)
      ];*/

      token[1] = this.walk(token[1]); // expr

      EACH(token[2], function(branch){ // body
        if (branch[0]) branch[0] = this.walk(branch[0]);
        //MAP(branch[1], walk, this);
        walkEach(this, branch[1]);
      }, this);
    },

    "conditional": function(token){ // type, cond, then, else
      //return [type, this.walk(cond), this.walk(body), this.walk(else_)];

      token[1] = this.walk(token[1]); // cond
      token[2] = this.walk(token[2]); // then
      token[3] = this.walk(token[3]); // else
    },
    "if": function(token){ // type, cond, then, else
      // return [type, this.walk(cond), this.walk(then), this.walk(else)];

      token[1] = this.walk(token[1]); // cond
      token[2] = this.walk(token[2]); // then
      if (token[3]) token[3] = this.walk(token[3]); // else
    },

    "assign": function(token){ // type, op, lvalue, rvalue
      // return [type, op, this.walk(lvalue), this.walk(rvalue)];

      token[2] = this.walk(token[2]); // lvalue
      token[3] = this.walk(token[3]); // rvalue
    },
    "binary": function(token){ // type, op, left, right
      // return [type, op, this.walk(left), this.walk(right)];

      token[2] = this.walk(token[2]); // left
      token[3] = this.walk(token[3]); // right
    },


    "dot": function(token){ // type, expr
      // return [ type, this.walk(expr) ].concat(slice(arguments, 2));

      token[1] = this.walk(token[1]); // expr
    },
    "stat": function(token){ // type, stat
      // return [type, this.walk(stat)];

      token[1] = this.walk(token[1]); // stat
    },
    "throw": function(token){ // type, expr
      //return [type, this.walk(expr)];

      token[1] = this.walk(token[1]); // expr
    },
    "return": function(token){ // type, expr
      // return [type, this.walk(expr)];

      if (token[1])
        token[1] = this.walk(token[1]); // expr
    },

    "call": function(token){ // type, expr, args
      // return [type, this.walk(expr), MAP(args, walk, this)];

      token[1] = this.walk(token[1]); // expr
      //MAP(token[2], walk, this); // args
      walkEach(this, token[2]);
    },

    "function": function(token){ // type, name, args, body
      //return [type, name, args.slice(), MAP(body, walk, this)];

      //MAP(token[3], walk, this); // body
      walkEach(this, token[3]);
    },
    "defun": function(token){ // type, name, args, body
      //return [type, name, args.slice(), MAP(body, walk, this)];

      //MAP(token[3], walk, this); // body
      walkEach(this, token[3]);
    },

    "for": function(token){ // type, init, cond, step, block
      // return [type, this.walk(init), this.walk(cond), this.walk(step), this.walk(block)];

      if (token[1]) token[1] = this.walk(token[1]); // init
      if (token[2]) token[2] = this.walk(token[2]); // cond
      if (token[3]) token[3] = this.walk(token[3]); // step
      if (token[4]) token[4] = this.walk(token[4]); // block
    },
    "for-in": function(token){ // type, vvar, key, hash, block
      // return [type, this.walk(vvar), this.walk(key), this.walk(hash), this.walk(block)];

      token[1] = this.walk(token[1]); // vvar
      token[2] = this.walk(token[2]); // key
      token[3] = this.walk(token[3]); // hash
      token[4] = this.walk(token[4]); // block
    },

    "while": function(token){ // type, cond, block
      // return [type, this.walk(cond), this.walk(block)];

      token[1] = this.walk(token[1]); // cond
      token[2] = this.walk(token[2]); // block
    },
    "do": function(token){ // type, cond, block
      // return [type, this.walk(cond), this.walk(block)];

      token[1] = this.walk(token[1]); // cond
      token[2] = this.walk(token[2]); // block
    },
    "with": function(token){ // type, expr, block
      // return [type, this.walk(expr), this.walk(block)];

      token[1] = this.walk(token[1]); // expr
      token[2] = this.walk(token[2]); // block
    },
    "sub": function(token){ // type, expr, subscript
      // return [type, this.walk(expr), this.walk(subscript)];

      token[1] = this.walk(token[1]); // expr
      token[2] = this.walk(token[2]); // subscript
    },

    "unary-prefix": function(token){ // type, op, expr
      // return [type, op, this.walk(expr)];

      token[2] = this.walk(token[2]); // expr
    },
    "unary-postfix": function(token){ // type, op, expr
      // return [type, op, this.walk(expr)];

      token[2] = this.walk(token[2]); // expr
    },
    "label": function(token){ // type, name, block
      // return [type, name, this.walk(block)];

      token[2] = this.walk(token[2]); // block
    },

    "object": function(token){ // type, props
      /*return [
        type,
        MAP(props, function(p){
          return p.length == 2
            ? [p[0], this.walk(p[1])]
            : [p[0], this.walk(p[1]), p[2]]; // get/set-ter
        }, this)
      ];*/

      EACH(token[1], function(token){ // props
        token[1] = this.walk(token[1]);
      }, this);
    },

    "seq": function(token){
      // return [type].concat(MAP(slice(arguments, 1), walk, this));

      for (var len = token.length, i = 1; i < len; i++)
        token[i] = this.walk(token[i]);
    }
  };

  var user = {};
  var stack = [];

  for (var key in defWalkers)
    if (defWalkers.hasOwnProperty(key))
    {
      if (defWalkers[key] !== $self)
        defWalkers[key] = count('def-' + key, defWalkers[key]);
      callCount['user-' + key] = 0;
    }

  var idx = 0;
  var walk = count('walk', function(ast){
    if (!ast)
    {
      var x = stack[stack.length - 1];
      var y = x ? x[0] + ' -> walk(null)' : false;
      if (y) callCount[y] = (callCount[y] || 0) + 1;
      callCount['walk(null)']++;
      return null;
    }

    stack.push(ast);
    var type = ast[0];

    var fn = user[ast[0]] || user['*'];
    if (fn)
    {
      callCount['user-' + type]++;

      //idx++; if (idx == -1) debugger; console.log('walk user ' + type + ' ' + idx);
      var ret = fn.apply({
        context: this,
        token: ast
      }, ast.slice(1));

      if (ret != null)
      {
        stack.pop();
        return ret;
      }
    }

    fn = defWalkers[ast[0]];
    if (fn !== $self)
      fn.call(this, ast);

    stack.pop();
    return ast;
  });

  function dive(ast) {
    callCount['dive']++;
    if (ast == null) return null;

    try {
      stack.push(ast);
      return defWalkers[ast[0]].apply(ast, ast);
    }
    finally {
      stack.pop();
    }
  };

  function with_walkers(customWalkers, cont){
    var old = overrideObject(user, customWalkers);
    var ast = cont(walker);
    restoreObject(user, customWalkers, old);
    return ast;
  };

  var walker = {
    walk: count('walker.walk', function(ast){
      var context = this;
      var old;

      if (context !== walker)
        context = {};

      old = overrideObject(context, overrideProps);

      ast = walk.call(context, ast);

      restoreObject(context, overrideProps, old);

      return ast;
    }),
    dive: count('dive', dive),
    with_walkers: count('with_walkers', with_walkers),
    parent: count('parent', function(){
      return stack[stack.length - 2]; // last one is current node
    }),
    stack: count('stack', function(){
      return stack;
    })
  };

  walker.walker = walker;

  var overrideProps = {
    walker: walker,
    walk: walk
  };

  return walker;
};

exports.ast_walker = ast_walker;