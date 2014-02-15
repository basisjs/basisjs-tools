
function isReserved(name){
  return name == 'this' ||
         name == 'false' || name == 'true' ||
         name == 'null' || name == 'undefined' ||
         name == 'eval' ||
         name == 'arguments';
}

function resolveName(token, asString, scope){
  var result;

  switch (token && token[0])
  {
    case 'dot':
      var rn = resolveName(token[1]);

      if (rn)
        result = rn.concat(token[2]);

      break;
    case 'name':
      var name = token[1];
      if (scope)
        var ref = scope.get(name);
        if (ref)
          ref = resolveName(ref[1]);
      result = [token[1]];
  }

  if (result && asString)
    return result.join('.');

  return result;
}

function resolveNameRef(token){
  var rn = resolveName(token);
  if (rn && !isReserved(res[0]))
    return res;
}

module.exports = {
  isReserved: isReserved,
  resolveName: resolveName,
  resolveNameRef: resolveNameRef
};
