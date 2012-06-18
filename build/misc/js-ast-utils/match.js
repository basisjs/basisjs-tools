var $ = {}, _ = {}, etc = {};

function MatchError(){
  return Error.apply(this, arguments);
}
MatchError.prototype = new Error();

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
  //null
  if (pattern === null){
    result.matched = value === null;
    return result;
  }
  //primitives
  if (typeof pattern !== 'object')
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

  }
  //functions
  if (typeof pattern === 'function')
  {

  }
  
  return result;
}

function match(/*pattern1, pattern2, ...*/){
  var patterns = Array.prototype.slice.call(arguments);
  var vars = [];
  return function(object){
    for(var i = 0; pattern = patterns[i]; i++){
      var matchResult = matches(object, pattern[0]);
      if (matchResult.matched)
      {
        if (pattern[1] instanceof Function)
        {
          return pattern[1].apply(object, matchResult.vars);
        }
        return pattern[1];
      }
    }
    throw new MatchError('unable to match ' + object + ' against ' + patterns);
  };
}

module.exports = {
  match: match,
  $: $,
  _: _,
  etc: etc,
  MatchError: MatchError
};