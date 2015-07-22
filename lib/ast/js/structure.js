var walker = require('./walker').ast_walker();
var translate = require('./translator.js').gen_code;

function process(ast, context){
  ast.throws = [];

  return walker.walk(ast, {
    'call': function(token){
      var expr = token[1];
      var args = token[2];

      this.walk(token, 1);
      this.walkEach(token[2]);

      var fn = this.scope.resolve(expr);

      if (fn)
      {
        if (fn.ref_)
          fn = fn.ref_;

        if (fn[0] == 'function' || fn[0] == 'defun')
        {
          if (fn.run)
          {
            context.console.start('> ' + translate(token));
            fn.run.call(this, token, expr[0] == 'dot' || expr[0] == 'name' ? this.scope.resolve(expr[1]) : null, args.map(function(a){
              return this.resolve(a) || a;
            }, this.scope));
            context.console.end();
          }
        }
        else
        {
          if (fn[0] == 'call' && fn.call && fn.call.run)
          {
            context.console.start('> ' + translate(token));
            fn.call.run.call(this, token, fn.call, args.map(this.scope.resolve, this.scope));
            context.console.end();
          }
        }
      }

      return token;
    },
    'return': function(token){
      var res = this.walk(token, 1);
      if (res.obj)
      {
        var callToken = this.top(2);
        callToken.ref_ = res.ref_ || res;
        if (callToken && callToken[0] == 'call' && !callToken.obj)
          callToken.obj = res.obj;
      }
      return token;
    },/*,
    'for-in': function(token){
      var v = token[1];
      var key = token[2][1];
      var obj = this.scope.resolve(token[3]);
      debugger;
      if (obj)
      {
        var oo = obj.obj;
        for (var k in oo)
        {
          var val = ['string', k];
          val.obj = k;
          this.scope.put(key, 'var', val);
          this.walk(token, 4);
        }
      }
    },
    'if': function(token){
      var res = this.walk(token, 1).obj;
      if (res && res[0] == 'name' && res[1] == 'true')
        this.walk(token, 2);
    },*/
    'defun': function(token){
      token.parent_ = this.top(1);
    },
    'dot': function(token){
      if (token.ref_)
        return;

      var path = this.walk(token[1]);
      if (path.ref_)
      {
        var obj = path.ref_.obj;
        if (obj && path.ref_[0] == 'call')
          obj = obj.obj;
        token.ref_ = obj && obj[token[2]];
        token.refPath_ = path.refPath_ + '.' + token[2];
      }
      return token;
    },
    'name': function(token){
      if (token.ref_)
        return;

      var name = token[1];
      if (this.scope.isGlobal(name) && name != 'global' && name != 'this') // TODO: make correct test for global
      {
        var ref = this.scope.get(name);
        if (ref)
        {
          token.ref_ = ref.token;
          token.refPath_ = name;
        }
      }
      else
      {
        var ref = this.scope.resolve(token);
        if (ref && ref.ref_)
        {
          token.ref_ = ref.ref_;
          token.refPath_ = ref.refPath_;
        }
      }
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
      var rvalue = token[3];

      if (op == true)
      {
        if (lvalue[0] == 'name')
        {
          rvalue = this.walk(rvalue);
          this.scope.set(lvalue[1], rvalue);

          return token;
        }
        if (lvalue[0] == 'dot')
        {
          lvalue = this.walk(lvalue);
          rvalue = this.walk(rvalue);

          var dest = this.scope.resolve(lvalue[1]);

          if (dest && dest.obj)
            dest.obj[lvalue[2]] = this.scope.resolve(rvalue) || rvalue;

          return token;
        }
      }
    },
    'throw': function(token){
      ast.throws.push(token);
    }
  }, context);
}

module.exports.process = process;
