
module.exports = function(flowData){

  var fconsole = flowData.console;
  var queue = flowData.files.queue;

  //
  // Init js section
  //

  fconsole.log('Init js');
  flowData.js = {
    rootBaseURI: {},
    getFileContext: getFileContext
  };

  //
  // Search for basis.js
  //

  fconsole.start('Search for basis.js');

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && file.basisScript)
    {
      fconsole.log('[OK] basis.js found at path ' + file.relPath);
      flowData.js.rootBaseURI.basis = file.baseURI;
      flowData.js.basisScript = file.filename;
      break;
    }

  if (!flowData.js.basisScript)
  {
    fconsole.log('[FAULT] basis.js not found (should be a <script> tag with src & basis-config attributes)');
    process.exit();
  }

  fconsole.endl();

  //
  // Process files
  //

  fconsole.start('Process scripts');
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.start(file.filename ? file.relpath : '[inline script]');

      processScript(file, flowData);

      fconsole.endl();
    }
  fconsole.endl();
};

module.exports.handlerName = '[js] Extract';


//
// main part
//

var path = require('path');
var at = require('./ast_tools');

var BASIS_RESOURCE = at.normalize('basis.resource');
var RESOURCE = at.normalize('resource');
var BASIS_REQUIRE = at.normalize('basis.require');

function getFileContext(file){
  return {
    __filename: file.filename || '',
    __dirname: file.baseURI,
    namespace: file.namespace || ''
  };
}

function processScript(scriptFile, flowData){
  var context = getFileContext(scriptFile);
  var content = scriptFile.content;

  if (flowData.options.buildMode)
  {
    content = content
      .replace(/;;;.*([\r\n]|$)/g, '')
      .replace(/\/\*\*\s*@cut.*?\*\/.*([\r\n]|$)/g, '');
  }

  // extend file info
  var deps = [];
  var resources = [];

  scriptFile.deps = deps;
  scriptFile.resources = resources;

  scriptFile.ast = at.walk(at.parse(content), {
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
              filename: path.resolve(scriptFile.baseURI, newFilename)
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
            var baseURI = flowData.js.rootBaseURI[root];

            newFile = flowData.files.add({
              source: 'js:basis.require',
              filename: (baseURI ? baseURI + '/' : '') + parts.join('/') + '.js'
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
