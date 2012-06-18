var Match = require('./match.js');
var match = Match.match;
var $ = Match.$;
var _ = Match._;
var etc = Match.etc;
var MatchError = Match.MatchError;

function walk(ast, callback){
  callback(ast);
  for (var i in ast)
  {
    if (Array.isArray(ast[i]))
    {
      walk(ast[i], callback);
    }
  }
}

function getName(expr){
  if (typeof expr == 'string')
  {
    return expr;
  }
  switch(expr[0])
  {
    case 'name': 
    case 'string': 
      return expr[1];
    case 'dot': 
    case 'sub': 
      return getName(expr[1]) + '.' + getName(expr[2]);
  }
}

function getDescendants(name, aliases){
  var result = [];
  var cursor = name;

  while(aliases[cursor]){
    result.push(aliases[cursor]);
    cursor = aliases[cursor];
  }
  return result;
}

function namesEqualInner(a, b, aliases){
  if (a === b)
  {
    return true;
  }

  var aDescendants = getDescendants(a, aliases);
  if (aDescendants.indexOf(b) !== -1)
  {
    return true;
  }

  var bDescendants = getDescendants(b, aliases);
  if (bDescendants.indexOf(a) !== -1)
  {
    return true;
  }

  for (var i = 0; i < aDescendants.length; i++){
    for (var j = 0; j < bDescendants.length; j++){
      if (aDescendants[i] == bDescendants[j])
      {
        return true;
      }
    }
  }

  return false;
}

function namesEqual(a, b, ast){
  var aliases = {};
  var matcher = match(
    [ ['assign', true, $, $], function(a, b){
      aliases[getName(a)] = getName(b);
    } ],
    [ ['var', $], function(names){
      names.forEach(function(name){
        aliases[name[0]] = getName(name[1]);
      });
    } ]
  );

  walk(ast, function(astNode){
    try
    {
      matcher(astNode);
    }
    catch(MatchError){}
  });
  
  return namesEqualInner(a, b, aliases);
}

module.exports = namesEqual;