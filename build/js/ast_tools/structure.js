
var walker = require('./walker').ast_walker();

function process(ast){

  function extract(token){
    var expr = token[1];
    var args = token[2];

    this.walk(token, 1);
    this.walkEach(token[2]);

    var fn = this.scope.resolve(token[1]);

    if (fn && (fn[0] == 'function' || fn[0] == 'defun') && fn.run)
    {
      //debugger;
      fn.run.call(this, token, token[1][0] == 'dot' ? this.scope.resolve(token[1][1]) : null, args.map(this.scope.resolve, this.scope));
    }

    return token;
  }

  return walker.walk(ast, {
    'call': extract/*,
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
    },
    'assign': function(token){
      var op = token[1];
      var lvalue = token[2];
      var rvalue = token[3];

      if (op == true)
      {
        var val = this.scope.resolve(rvalue);
        if (val && val[0] == 'num' && lvalue[0] == 'sub')
        {
          var left = this.scope.resolve(lvalue[1]);
          if (left)
          {
            left.obj[this.scope.resolve(lvalue[2])[1]] = val;
          }
        }
      }
    }*/
  });
}

module.exports.process = process;