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
      fconsole.log(file.filename ? file.relpath : '[inline script]');
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

var path = require('path');
var at = require('./ast_tools');

var BASIS_RESOURCE = at.normalize('basis.resource');
var RESOURCE = at.normalize('resource');
var BASIS_REQUIRE = at.normalize('basis.require');

function processScript(file, flowData){
  var deps = [];
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
  file.deps = deps;
  file.ast = at.walk(at.parse(content), {
    "call": function(expr, args){
      var filename;
      var newFile;

      switch (at.translate(expr))
      {
        case BASIS_RESOURCE:
          filename = at.getCallArgs(args, context)[0];
          if (filename)
          {
            newFile = flowData.files.add({
              source: 'js:basis.resource',
              filename: filename
            });
            newFile.isResource = true;

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
          filename = at.getCallArgs(args, context)[0];
          //console.log(JSON.stringify(arguments));
          //console.log('resource call found:', translateCallExpr(expr, args));
          if (filename)
          {
            newFile = flowData.files.add({
              source: 'js:basis.resource',
              filename: path.resolve(file.baseURI, filename)
            });
            newFile.isResource = true;
            
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
          filename = at.getCallArgs(args, context)[0];
          //console.log('basis.require call found:', translateCallExpr(expr, args));
          if (filename)
          {
            var namespace = filename;
            var parts = namespace.split(/\./);
            var root = parts[0];
            filename = path.resolve(flowData.js.rootBaseURI[root] || flowData.inputDir, parts.join('/')) + '.js';

            newFile = flowData.files.add({
              source: 'js:basis.require',
              filename: filename
            });
            newFile.namespace = namespace;
            newFile.package = root;

            //if (!flowData.js.package[root])
            //  flowData.js.package[root].push(file);

            deps.push(newFile);
          }

          break;
      }
    }
  });
}


