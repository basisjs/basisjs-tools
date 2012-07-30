
var vm = require('vm');
var parser = require("uglify-js").parser;
var processor = require("uglify-js").uglify;
//var namesEqual = require('./name-compare');

//var walker = processor.ast_walker();
var walker = require('./walker').ast_walker();

var resolver = require('./resolver');

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
  /*map: function(tokens, fn){
    return processor.MAP(tokens, fn || walker.walk);
  },
  walker: walker,*/
  getAstTop: getAstTop,
  normalize: normalize,
  getCallArgs: getCallArgs,

  isAstEqualsCode: isAstEqualsCode,

  translate: translate,
  translateCallExpr: translateCallExpr,

  append: function(ast, appendAst){
    ast[1].push.apply(ast[1], appendAst[1]);
  },

  walk: function(ast, handlers, context){
    return walker.with_walkers(handlers, function(){
      return walker.walk.call(context || walker, ast);
    });
  },

  processPath: function(ast, rootNames, refs, classMap){
    return resolver.process(ast, walker, rootNames, refs, classMap);
  },
  resolvePath: function(path, refName, refs){
    return resolver.resolve(refs, path, refName);
  },
  removeClassDefRef: function(classDef){
    if (!classDef.refCount)
    {
      console.log('> No reference for classDef already - is it a bug?');
      return;
    }

    if (--classDef.refCount == 0)
    {
      //console.log('[!!!!] Last ref, cur classDef', this.translate(classDef));
      var inner = [];
      walker.with_walkers({
        '*': function(){
          if (this.token.classDef)
            inner.push(this.token.classDef);
        }
      }, function(){
        walker.walk(classDef);
      });

      console.log('> INNER:', inner.length);
      inner.forEach(function(classDef){
        this.removeClassDefRef(classDef);
      }, this);

      classDef.splice(0, classDef, 'name', 'undefined');

      return true;
    }
  }
};
