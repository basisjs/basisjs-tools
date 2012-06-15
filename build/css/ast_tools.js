
var csso = require('csso');

module.exports = {
  translate: function(ast){
    return csso.translate(csso.cleanInfo(ast));
  },
  walk: function(ast, handlers){
    function walk(token, offset){
      for (var i = 2, childToken; childToken = token[i]; i++)
      {
        var handler = handlers[childToken[1]];

        if (typeof handler == 'function')
          handler(childToken, token, i);

        walk(childToken);
      }
    }

    walk(ast);
  },

  wsFilter: function(token){
    return token[1] != 's' && token[1] != 'comment';
  },
  unpackString: function(val){
    return val.substr(1, val.length - 2);
  },
  unpackUri: function(token){
    var val = token.slice(2).filter(this.wsFilter)[0];

    if (val[1] == 'string')
      return unpackStringToken(val[2]);
    else
      return val[2];
  }
};