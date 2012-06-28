var processor = require('uglify-js').uglify;
var parser = require('uglify-js').parser;
var namesEqual = require('./name-compare');

//@fixme: works only for "call"
function isAstEqualsCode(expr, code){
  return processor.gen_code(parser.parse(code)[1][0][1]) == processor.gen_code(expr);
}

function getCallArgs(args, context){
  return args.map(function(arg){
    if (arg[0] == 'string')
    {
      return arg[1];
    }
    else
    {
      try
      {
        var result = new Function('context', 'with(context){ return ' + processor.gen_code(arg) + '}')(context);
        if (typeof result == 'string' || typeof result == 'object')
          return result;
      }
      catch(e)
      {
        console.log('unable to evaluate "', processor.gen_code(arg), '" in context ', context);
      }
    }
  });
}

module.exports = {
  isAstEqualsCode: isAstEqualsCode,
  getCallArgs: getCallArgs
};