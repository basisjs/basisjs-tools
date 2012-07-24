
var vm = require('vm');
var parser = require("uglify-js").parser;
var processor = require("uglify-js").uglify;
//var namesEqual = require('./name-compare');

//var walker = processor.ast_walker();
var walker = require('./walker').ast_walker();

function parse(code){
  return parser.parse(code);
}

function getAstTop(code){
  //return top level statement's ast
  return parser.parse(code)[1][0][1];
}

function normalize(code){
  return translate(getAstTop(code));
}

//@fixme: works only for "call"
function isAstEqualsCode(expr, code){
  return translate(expr) == normalize(code);
}

function translate(ast){
  return processor.gen_code(ast);
}

function translateCallExpr(expr, args){
  return translate(expr) + '(' + args.map(translate).join(', ') + ')';
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
        var code = translate(arg);
        var result = vm.runInNewContext('0,' + code, context);
        if (typeof result == 'string' || typeof result == 'object')
          return result;
      }
      catch(e)
      {
        console.log('Unable to evaluate "', code, '" in context ', context);
      }
    }
  });
}

module.exports = {
  parse: parse,
  map: function(tokens, fn){
    return processor.MAP(tokens, fn || walker.walk);
  },
  walker: walker,
  getAstTop: getAstTop,
  normalize: normalize,
  getCallArgs: getCallArgs,

  isAstEqualsCode: isAstEqualsCode,

  translate: translate,
  translateCallExpr: translateCallExpr,

  append: function(ast, appendAst){
    ast[1].push.apply(ast[1], appendAst[1]);
  },

  walk: function(ast, handlers){
    return walker.with_walkers(handlers, function(){
      return walker.walk(ast);
    });
  }
};