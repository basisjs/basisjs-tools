var csso = require('csso');
var parse = require('./gonzales.js').srcToCSSP;
var translate = require('./translate');
var walk = require('./walker');

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

// use own cleanInfo function as 3x times faster than csso.cleanInfo
function cleanInfo(token){
  var res = token.slice(1);
  for (var i = 1, childToken; childToken = res[i]; i++)
    if (Array.isArray(childToken))
      res[i] = cleanInfo(childToken);
  return res;
}

module.exports = {
  translate: function(ast){
    return translate(ast, true);
  },
  walk: function(ast, handlers, context){
    return walk(ast, function(token, parent, stack){
      var handler = typeof handlers == 'function' ? handlers : handlers[token[1]];

      if (typeof handler == 'function')
        handler.call(context, token, parent, stack);
    }, true);
  },
  parse: function(content, isRule){
    if (isRule)
      return parse('{' + content + '}', 'block', true);
    else
      return parse(content, 'stylesheet', true) || [{ ln: 1 }, 'stylesheet'];
  },
  copy: function copy(ast, copyInfo){
    var result = ast.slice();
    var newInfo = {};
    var oldInfo = ast[0];

    result[0] = newInfo;

    if (copyInfo)
      for (var key in oldInfo)
        newInfo[key] = oldInfo[key];

    for (var i = 2; i < ast.length; i++)
      result[i] = Array.isArray(ast[i]) ? copy(ast[i], copyInfo) : ast[i];

    return result;
  },

  wsFilter: wsFilter,
  unpackString: unpackString,
  unpackUri: unpackUri,
  packWhiteSpace: packWhiteSpace,
  packString: packString,
  packComment: packComment,
  packUri: packUri
};
