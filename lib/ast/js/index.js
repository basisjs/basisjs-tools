
var vm = require('vm');
var parser = require('./uglifyjs-parser');
var processor = require('uglify-js').uglify;
var translate = require('./translator').gen_code;

//var walker = processor.ast_walker();
var walker = require('./walker').ast_walker();
var scope = require('./scope');
var names = require('./names');
var structure = require('./structure');
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

function splitLines(code, maxLineLength){
  var splits = [0];

  parser.parse(function(){
    var nextToken = parser.tokenizer(code);
    var lastSplit = 0;
    var prevToken;

    function custom(){
      var token = nextToken.apply(this, arguments);

      if (!prevToken || prevToken.type != 'keyword')
        if (token.pos - lastSplit > maxLineLength)
          if (token.type == 'keyword' ||
              token.type == 'atom' ||
              token.type == 'name' ||
              token.type == 'punc')
          {
            lastSplit = token.pos;
            splits.push(lastSplit);
          }

      prevToken = token;

      return token;
    }

    custom.context = function(){
      return nextToken.context.apply(this, arguments);
    };

    return custom;
  }());

  return splits.map(function(pos, i){
    return code.substring(pos, splits[i + 1] || code.length);
  }).join('\n');
}

//@fixme: works only for "call"
function isAstEqualsCode(expr, code){
  return translate(expr) == normalize(code);
}

function translateCallExpr(expr, args){
  return translate(expr) + '(' + args.map(translate).join(', ') + ')';
}

function getCallArgs(args, context, flow, file){
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
      } catch(e) {
        if (flow)
          flow.warn({
            file: file ? file.relpath : '',
            message: 'Unable to evaluate: ' + code
          });
        else
          console.log('Unable to evaluate: ' + code);
      }
    }
  });
}

module.exports = {
  isReserved: names.isReserved,
  resolveName: names.resolveName,
  resolveNameRef: names.resolveNameRef,

  Scope: scope.Scope,
  applyScope: scope.process,

  struct: structure.process,
  createRunner: function(fn){
    var token = ['function', null, []];
    token.run = fn;
    return token;
  },

  //////

  parse: function(text, top){
    var ast = parse(text);
    return top ? ast[1][0][1] : ast;
  },
  normalize: normalize,
  getCallArgs: getCallArgs,

  isAstEqualsCode: isAstEqualsCode,

  translate: translate,
  translateCallExpr: translateCallExpr,
  translateDefaults: require('./translator').setDefaults,
  splitLines: splitLines,

  prepend: function(ast, prependAst){
    var stat = ast[1][0];
    if (stat && stat[0] == 'function' && !stat[1])
      Array.prototype.unshift.apply(stat[3], prependAst[1]);
    else
      Array.prototype.unshift.apply(ast[1], prependAst[1]);
  },
  append: function(ast, appendAst){
    var stat = ast[1][0];
    if (stat && stat[0] == 'function' && !stat[1])
      Array.prototype.push.apply(stat[3], appendAst[1]);
    else
      Array.prototype.push.apply(ast[1], appendAst[1]);
  },

  walk: function(ast, walkers, context){
    return walker.walk(ast, walkers, context);
  },

  processPath: function(ast, rootNames, refs, exportMap, namespace){
    return resolver.process(ast, walker, rootNames, refs, exportMap, namespace);
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
      walker.walk(classDef, function(token){
        if (token.resourceRef)
          token.resourceRef.jsRefCount--;
        if (token.classDef)
          inner.push(token.classDef);
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
