//
// export handler
//

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  //console.log(JSON.stringify(at.parse('1+2')));
  //process.exit();

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.start(file.filename ? file.relpath : '[inline script]');

      processScript(file, flowData);

      fconsole.endl();
    }
};

module.exports.handlerName = '[js] Parse & expand';


//
// main part
//

var path = require('path');
var at = require('./ast_tools');

var BASIS_RESOURCE = at.normalize('basis.resource');
var RESOURCE = at.normalize('resource');
var BASIS_REQUIRE = at.normalize('basis.require');

function processScript(file, flowData){
  var inputDir = flowData.inputDir;
  var content = file.content;
  var context = flowData.js.getFileContext(file);

  if (flowData.options.buildMode)
  {
    content = content
      .replace(/;;;.*([\r\n]|$)/g, '')
      .replace(/\/\*\*\s*@cut.*?\*\/.*([\r\n]|$)/g, '');
  }

  // extend file info
  var deps = [];
  var resources = [];

  file.deps = deps;
  file.resources = resources;

  file.ast = at.walk(at.parse(content), {
    "call": function(expr, args){
      var newFilename;
      var newFile;

      switch (at.translate(expr))
      {
        case BASIS_RESOURCE:
          newFilename = at.getCallArgs(args, context)[0];
          if (newFilename)
          {
            newFile = flowData.files.add({
              source: 'js:basis.resource',
              filename: newFilename
            });
            newFile.isResource = true;

            resources.push(newFile);

            return [
              'call',
              ['dot', ['name', 'basis'], 'resource'],
              [
                ['string', newFile.relpath]
              ]
            ];
          }

          break;

        case RESOURCE:
          newFilename = at.getCallArgs(args, context)[0];
          //console.log(JSON.stringify(arguments));
          //console.log('resource call found:', translateCallExpr(expr, args));
          if (newFilename)
          {
            newFile = flowData.files.add({
              source: 'js:basis.resource',
              filename: path.resolve(file.baseURI, newFilename)
            });
            newFile.isResource = true;

            resources.push(newFile);
            
            return [
              'call',
              ['dot', ['name', 'basis'], 'resource'],
              [
                ['string', newFile.relpath]
              ]
            ];
          }

          break;

        case BASIS_REQUIRE:
          newFilename = at.getCallArgs(args, context)[0];
          //console.log('basis.require call found:', translateCallExpr(expr, args));
          if (newFilename)
          {
            var namespace = newFilename;
            var parts = namespace.split(/\./);
            var root = parts[0];
            newFilename = path.resolve(flowData.js.rootBaseURI[root] || flowData.inputDir, parts.join('/')) + '.js';

            newFile = flowData.files.add({
              source: 'js:basis.require',
              filename: newFilename
            });
            newFile.namespace = namespace;
            newFile.package = root;

            deps.push(newFile);
          }

          break;
      }
    }
  });
}


