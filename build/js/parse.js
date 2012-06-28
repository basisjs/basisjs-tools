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
var at = require('./ast-utils');

var BASIS_RESOURCE = at.normalize('basis.resource');
var RESOURCE = at.normalize('resource');
var BASIS_REQUIRE = at.normalize('basis.require');

function processScript(file, flowData){
  var deps = [];
  var inputDir = flowData.inputDir;
  var context = {
    __filename: file.filename ? file.filename : '',
    __dirname: file.filename ? path.dirname(file.filename) + '/' : ''
  };

  // extend file info
  file.deps = deps;
  file.ast = at.parse(file.content);
  
  at.walk(file.ast, {
    "call": function(expr, args){
      var filename;
      var file;

      switch (translate(expr))
      {
        case BASIS_RESOURCE:
          filename = at.getCallArgs(args, context)[0];
          //console.log('basis.resource call found:', translateCallExpr(expr, args));
          if (filename)
          {
            file = flowData.files.add({
              source: 'js:basis.resource',
              filename: path.resolve(inputDir, filename)
            });
            file.isResource = true;
          }

          break;

        case RESOURCE:
          filename = at.getCallArgs(args, context)[0];
          //console.log('resource call found:', translateCallExpr(expr, args));
          if (filename)
          {
            file = flowData.files.add({
              source: 'js:basis.resource',
              filename: path.resolve(context.__dirname, filename)
            });
            file.isResource = true;
          }

          break;

        case BASIS_REQUIRE:
          filename = at.getCallArgs(args, context)[0];
          //console.log('basis.require call found:', translateCallExpr(expr, args));
          if (filename)
          {
            var parts = filename.split(/\./);
            filename = path.resolve(flowData.js.base[parts[0]] || flowData.inputDir, parts.join('/')) + '.js';
            
            file = flowData.files.add({
              source: 'js:basis.require',
              filename: filename
            });

            deps.push(file);
          }

          break;
      }
    }
  });
}


