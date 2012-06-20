//
// export handler
//

module.exports = function JSFileHandler(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? flowData.files.relpath(file.filename) : '[inline script]');
      fconsole.incDeep();

      processScript(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
};

module.exports.handlerName = 'Parse and expand javascript';


//
// main part
//

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var parser = require("uglify-js").parser;
var processor = require("uglify-js").uglify;


var walker = processor.ast_walker();

var BASIS_RESOURCE = translate(getAST('basis.resource'));
var RESOURCE = translate(getAST('resource'));
var BASIS_REQUIRE = translate(getAST('basis.require'));

function translate(ast){
  return processor.gen_code(ast);
}

function translateCallExpr(expr, args){
  return translate(expr) + '(' + args.map(translate).join(', ') + ')';
}

function getAST(code){
  //return top level statement's ast
  return parser.parse(code)[1][0][1];
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
        // very slow: vm.runInNewContext(translate(arg), context);
        var result = Function('__dirname, __filename', 'return ' + translate(arg)).call(null, context.__dirname, context.__filename);
        if (typeof result == 'string')
          return result;
      }
      catch(e)
      {
        console.log('unable to evaluate "', translate(arg), '" in context ', context);
      }
    }
  });
}


function processScript(file, flowData){

  var code = file.content;
  var ast = parser.parse(code);
  var deps = [];
  var inputDir = flowData.inputDir;
  var context = {
    __filename: file.filename ? file.filename : '',
    __dirname: file.filename ? path.dirname(file.filename) + '/' : ''
  };

  walker.with_walkers({
    "call": function(expr, args){
      switch (translate(expr))
      {
        case BASIS_RESOURCE:
          var filename = getCallArgs(args, context)[0];
          //console.log('basis.resource call found:', translateCallExpr(expr, args));
          if (filename)
          {
            filename = path.resolve(inputDir, filename);
            flowData.files.add({
              source: 'js:basis.resource',
              filename: filename
            }).isResource = true;
          }

          break;

        case RESOURCE:
          var filename = getCallArgs(args, context)[0];
          //console.log('resource call found:', translateCallExpr(expr, args));
          if (filename)
          {
            filename = path.resolve(context.__dirname, filename);
            flowData.files.add({
              source: 'js:basis.resource',
              filename: filename
            }).isResource = true;
          }

          break;

        case BASIS_REQUIRE:
          var filename = getCallArgs(args, context)[0];
          //console.log('basis.require call found:', translateCallExpr(expr, args));

          if (filename)
          {
            var parts = filename.split(/\./);
            filename = path.resolve(flowData.js.base[parts[0]] || flowData.inputDir, parts.join('/')) + '.js';
            
            flowData.files.add({
              source: 'js:basis.require',
              filename: filename
            });

            deps.push(filename);
          }

          break;
      }
    }
  }, function(){
    return walker.walk(ast);
  });

  // extend file info
  file.ast = ast;
  file.deps = deps;
}


