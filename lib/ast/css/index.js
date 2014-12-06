var csso = require('csso');
var parse = require('./gonzales.js').srcToCSSP;

function wsFilter(token){
  return token[1] != 's' && token[1] != 'comment';
}

function unpackString(val){
  return val.substr(1, val.length - 2);
};

function unpackUri(token){
  var val = token.slice(2).filter(wsFilter)[0];

  if (val[1] == 'string')
    return unpackString(val[2]);
  else
    return val[2];
}

function packWhiteSpace(ws){
  return [{}, 's', String(ws).replace(/\S/g, ' ') || ' '];
}

function packString(string){
  return [{}, 'string', '"' + String(string).replace(/\"/, '\\"') + '"'];
}

function packComment(comment){
  return [{}, 'comment', String(comment).replace(/\*\//g, '* /')];
}

function packUri(uri, token){
  token = token || [{}, 'uri'];
  token[2] = String(uri).indexOf(')') != -1 ? packString(uri) : [{}, 'raw', uri];
  return token;
}

module.exports = {
  translate: function(ast){
    return csso.translate(csso.cleanInfo(ast));
  },
  walk: function(ast, handlers, context){
    function walk(token, offset){
      stack.push(token);
      for (var i = 2, childToken; childToken = token[i]; i++)
      {
        var handler = typeof handlers == 'function' ? handlers : handlers[childToken[1]];

        if (typeof handler == 'function')
          handler.call(context, childToken, token, i, stack);

        walk(childToken);
      }
      stack.pop();
    }

    var stack = [];
    walk([{}, '', ast]);
  },
  parse: function(content, isRule){
    if (isRule)
      return parse('{' + content + '}', 'block', true);
    else
      return parse(content, 'stylesheet', true) || [{ ln: 1 }, 'stylesheet'];
  },

  wsFilter: wsFilter,
  unpackString: unpackString,
  unpackUri: unpackUri,
  packWhiteSpace: packWhiteSpace,
  packString: packString,
  packComment: packComment,
  packUri: packUri
};
