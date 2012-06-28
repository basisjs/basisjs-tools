var $ = {}, _ = {}, etc = {};

function matches(value, pattern){
  var result = {vars: [], matched: false};
  if (pattern === _)
  {
    result.matched = true;
    return result;
  }
  if (pattern === $)
  {
    result.matched = true;
    result.vars.push(value);
    return result;
  }
  //undefined
  if (typeof pattern == 'undefined')
  {
    result.matched = typeof value == 'undefined';
    return result;
  }
  //null
  if (pattern === null){
    result.matched = value === null;
    return result;
  }
  //primitives
  if (['boolean', 'number', 'string'].indexOf(typeof pattern) !== -1)
  {
    result.matched = value === pattern;
    return result;
  }
  //regexps
  if (pattern instanceof RegExp)
  {
    result.matched = false;
    if (typeof value == 'string')
    {
      var match = value.match(pattern);
      result.matched = !!match;
      if (result.matched)
      {
        result.vars.push(match);
      }
    }
    return result;
  }
  //arrays
  if (Array.isArray(pattern))
  {
    result.matched = true;
    if(!Array.isArray(value)){
      result.matched = false;
      return result;
    }
    for(var i = 0; i < pattern.length; i++)
    {
      if(pattern[i] == etc){
        result.matched = true;
        break; 
      }
      var matchInfo = matches(value[i], pattern[i]);
      if (!matchInfo.matched)
      {
        result.matched = false;
        break;
      }
      result.vars = result.vars.concat(matchInfo.vars);
    }
    return result;
  }
  //objects
  if (typeof pattern === 'object')
  {
    result.matched = true;
    if(typeof value != 'object'){
      result.matched = false;
    }
    for(var prop in pattern)
    {
      var matchInfo = matches(value[prop], pattern[prop]);
      if (!matchInfo.matched)
      {
        result.matched = false;
        break;
      }
      result.vars = result.vars.concat(matchInfo.vars);
    }
    return result; 
  }
  //functions
  if (typeof pattern == 'function')
  {
    result.matched = pattern(value);
  }
  
  return result;
}

function match(/*pattern1, pattern2, ...*/){
  var patterns = Array.prototype.slice.call(arguments);
  if (patterns.length === 0)
  {
    throw {
      name: 'InvocationError',
      message: 'match should be called with one or more arguments'
    };
  }
  var vars = [];
  return function(object){
    for(var i = 0; pattern = patterns[i]; i++){
      var matchResult = matches(object, pattern[0]);
      if (matchResult.matched)
      {
        if (pattern[1] instanceof Function)
        {
          var result = pattern[1].apply(object, matchResult.vars);
          return (result instanceof Number || result instanceof String || result instanceof Boolean) ?
              result.valueOf() : result;
        }
        return pattern[1];
      }
    }
    throw {
      name: 'MatchError',
      message: 'unable to match ' + object + ' against ' + patterns
    };
  };
}

module.exports = {
  match: match,
  $: $,
  _: _,
  etc: etc
};