var recast = require('recast');
var fnDecl = require('./transformers/fnDeclaration');
var PATH = require('path');
var FS = require('fs');

var config = require('./config.json');

function resolvePath(filename) {
  var root = process.cwd();
  var sourceFolder = PATH.resolve(root, config.sourceFolder);
  // startsWith
  return filename.indexOf(sourceFolder) === 0 ? filename.replace(root, '') : null;
}

function toBase64(code){
  return new Buffer(code).toString('base64');
}

function generateSourceMap(code){
  return [
    '\n//# sourceMappingURL=data:application/json;base64,',
    toBase64(code)
  ].join('');
}

function instrumentCode(content, filename){
  var ast = recast.parse(content, {
    // sourceFileName should point on the same file
    sourceFileName: filename
  });

  recast.visit(ast, fnDecl);

  var instrumentedCode = recast.print(ast, {
    sourceMapName: filename + '.map'
  });

  return instrumentedCode.code.concat(generateSourceMap(JSON.stringify(instrumentedCode.map)));
};

function processCode(content, filename, cb){
  try{
    var filename = resolvePath(filename);
    var result = filename ? instrumentCode(content, filename) : content;
    cb(null, result);
  } catch(e){
    cb(e, null);
  }
}

function processFile(filename, cb){
  return FS.readFile(filename, 'utf-8', function(err, content){
    if (err) cb(err, null);
    processCode(content, filename, cb);
  });
}

module.exports = {
  resolvePath: resolvePath,
  instrumentCode: instrumentCode,
  processCode: processCode,
  processFile: processFile
};
