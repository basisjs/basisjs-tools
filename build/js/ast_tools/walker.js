
var processor = require("uglify-js").uglify;

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
  var user = {};
  var stack = [];
  var scope;

  function walkEach(array){
    for (var i = 0, len = array.length; i < len; i++)
      array[i] = walk(array[i]);
  };

  var idx = 0;
  function walk(ast, idx){
    var token = typeof idx == 'number' && ast ? ast[idx] : ast;

    if (!token)
      return ast;

    stack.push(token);

    var storedScope = scope;
    var scopeSwitch = false;
    if (token.scope)
    {
      scopeSwitch = true;
      scope = token.scope;
    }

    var userFn = user[token[0]] || user['*'];
    if (userFn)
    {
      //idx++; if (idx == -1) debugger; console.log('walk user ' + type + ' ' + idx);
      walkerContext.scope = scope;

      var ret = userFn.call(walkerContext, token);

      walkerContext.scope = storedScope;

      if (ret != null)
      {
        if (idx)
          ast[idx] = ret;

        scope = storedScope;
        stack.pop();

        return ret;
      }

      if (token.scope)
        scope = token.scope;
    }

    switch (token[0])
    {
      case "toplevel": // type, statements
      case "block":    // type, statements
      case "splice":   // type, statements
      case "array":    // type, elements

        //if (token[1]) walkEach(token[1]); // statements or elements

        var body = token[1];
        if (body)
          for (var i = 0, len = body.length; i < len; i++)
            body[i] = walk(body[i]);

        break;

      case "seq":      // type, ...tokens

        for (var len = token.length, i = 1; i < len; i++)
          token[i] = walk(token[i]);

        break;

      case "var":      // type, defs
      case "const":    // type, defs

        for (var i = 0, defs = token[1], def; def = defs[i]; i++)
          if (def[1]) // value; optional for var defs
            walk(def, 1);

        break;

      case "object":   // type, props

        for (var i = 0, props = token[1], prop; prop = props[i]; i++)
          walk(prop, 1);

        break;

      case "switch":   // type, expr, body

        walk(token, 1);    // expr

        for (var i = 0, branches = token[2], branch; branch = branches[i]; i++)
        {
          if (branch[0])               // branch expr
            branch[0] = walk(branch[0]);

          walkEach(branch[1]);  // branch body
        }

        break;

      case "new":      // type, ctor, args
      case "call":     // type, expr, args

        walk(token, 1); // ctor | expr
        walkEach(token[2]);     // args

        break;

      case "function": // type, name, args, body
      case "defun":    // type, name, args, body

        walkEach(token[3]);     // body

        break;

      case "try":      // type, try, catch, finally

        walkEach(token[1]);                // try
        if (token[2]) walkEach(token[2][1]); // catch
        if (token[3]) walkEach(token[3]);    // finally

        break;

      case "assign":   // type, op, left, right
      case "binary":   // type, op, left, right

        walk(token, 2); // left
        walk(token, 3); // right

        break;

      case "while":    // type, cond, block
      case "do":       // type, cond, block
      case "with":     // type, expr, block
      case "sub":      // type, expr, subscript

        walk(token, 1); // cond | expr
        walk(token, 2); // block | subscript

        break;

      case "conditional": // type, cond, then, else

        walk(token, 1); // cond
        walk(token, 2); // then
        walk(token, 3); // else

        break;

      case "if":       // type, cond, then, else

        walk(token, 1); // cond
        walk(token, 2); // then
        if (token[3]) walk(token, 3); // else

        break;

      case "for-in":   // type, vvar, key, hash, block

        walk(token, 1); // vvar
        walk(token, 2); // key
        walk(token, 3); // hash
        walk(token, 4); // block

        break;

      case "for":      // type, init, cond, step, block

        if (token[1]) walk(token, 1); // init
        if (token[2]) walk(token, 2); // cond
        if (token[3]) walk(token, 3); // step
        if (token[4]) walk(token, 4); // block

        break;

      case "stat":     // type, stat
      case "dot":      // type, expr
      case "throw":    // type, expr

        walk(token, 1); // expr | stat

        break;

      case "return":   // type, expr

        if (token[1]) walk(token, 1); // expr

        break;

      case "unary-prefix":          // type, op, expr
      case "unary-postfix":         // type, op, expr
      case "label":                 // type, name, block

        walk(token, 2); // expr | block

        break;

      // nothing to do
      /*
      case "debugger":  // function(type){ return [type]; },
      case "string":    // function(str){ return [type, str]; },
      case "num":       // function(num){ return [type, num]; },
      case "name":      // function(name){ return [type, name]; },
      case "break":     // function(label){ return [type, label]; },
      case "continue":  // function(label){ return [type, label]; },
      case "regexp":    // function(rx, mods){ return [type, rx, mods]; },
      case "atom":      // function(name){ return [type, name]; },
      case "directive": // function(dir){ return [type, dir]; }
      */
    }

    scope = storedScope;
    stack.pop();

    return ast;
  };

  var walker = {
    walk: function(ast, customWalkers, context){
      if (typeof customWalkers == 'function')
        customWalkers = { '*': customWalkers };

      var oldContext;
      var oldUser = overrideObject(user, customWalkers);

      if (context && context !== contextStack)
      {
        contextStack.push(walkerContext);
        oldContext = overrideObject(context, overrideProps);
        walkerContext = context;
      }

      ast = walk(ast);

      if (context && context !== contextStack)
      {
        restoreObject(context, overrideProps, oldContext);
        walkerContext = contextStack.pop();
      }

      restoreObject(user, customWalkers, oldUser);

      return ast;
    },
    stack: stack
  };

  var overrideProps = {
    walker: walker,
    walk: walk,
    stack: stack,
    scope: null
  };

  var contextStack = [];
  var walkerContext = {};

  overrideObject(walkerContext, overrideProps);

  return walker;
};

exports.ast_walker = ast_walker;