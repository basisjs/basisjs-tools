
var walker = require('./walker').ast_walker();

function process(ast, context){

  function extract(token){
    var expr = token[1];
    var args = token[2];

    this.walk(token, 1);
    this.walkEach(token[2]);

    var fn = this.scope.resolve(expr);
    // if (expr[0] == 'dot' && expr[1][0] == 'name' && expr[1][1] == 'Emitter' && expr[2] == 'subclass')
    // {
    //   console.log(expr[1]);
    //   console.log(fn);
    //   global.process.exit();
    // }

    if (fn)
    {
      //debugger;
      if (fn.ref_)
        fn = fn.ref_;

      if (fn[0] == 'function' || fn[0] == 'defun')
      {
        if (fn.run)
          fn.run.call(this, token, expr[0] == 'dot' || expr[0] == 'name' ? this.scope.resolve(expr[1]) : null, args.map(this.scope.resolve, this.scope));
      }
      else
      {
        if (fn[0] == 'call' && fn.call && fn.call.run)
          fn.call.run.call(this, token, fn.call, args.map(this.scope.resolve, this.scope));
      }
    }


    return token;
  }

  return walker.walk(ast, {
    'return': function(token){
      var res = this.walk(token, 1);
      if (res.obj)
      {
        var callToken = this.top(2);
        //console.log(this.stack.slice().reverse().map(function(t){ return t[0]}));
        if (callToken && callToken[0] == 'call' && !callToken.obj)
          callToken.obj = res.obj;
      }
    },
    'call': extract,/*,
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
      // if (/*token[1][0] == 'name' && token[1][1] == 'dom' && */token[2] == 'from') {        
      //   console.log('~~', path.ref_);
      //   console.log(this.scope.resolve(token[1]));
      //   console.log(this.scope.get('dom'));
      //   console.log(path.ref_);
      //   global.process.exit();
      // }
      if (path.ref_)
      {
        var obj = path.ref_.obj;
        if (obj && path.ref_[0] == 'call')
          obj = obj.obj;
        token.ref_ = obj && obj[token[2]];
        token.refPath_ = path.refPath_ + '.' + token[2];
      }
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
    'assign': function(token){
      var op = token[1];
      var lvalue = token[2];

      if (op == true && lvalue[0] == 'dot')
      {
        var rvalue = this.walk(token, 3);
        var dest = this.scope.resolve(lvalue[1]);

        if (dest && dest.obj)
          dest.obj[lvalue[2]] = this.scope.resolve(rvalue) || rvalue;

        return token;
      }
    }
  }, context);
}

module.exports.process = process;
