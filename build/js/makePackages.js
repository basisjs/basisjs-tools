
var at = require('./ast_tools');

module.exports = function(flow){

  var packages = {};
  var queue = flow.files.queue;
  
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && file.package)
    {
      var package = packages[file.package];
      if (!package)
        package = packages[file.package] = [];

      package.push.apply(package, buildDep(file, file.package));
    }

  flow.js.packages = packages;

  /*for (var name in packages)
  {
    var files = packages[name];
    for (var i = 0, file; file = files[i]; i++)
    {
      console.log(files[i].relpath);
      at.struct(file.ast);
      console.log(file.ast.scope.exports);
    }
  }*/
}

module.exports.handlerName = '[js] Make packages';

//
// make require file list
//

function buildDep(file, package){
  var files = [];

  if (file.processed || file.package != package)
    return files;

  file.processed = true;

  for (var i = 0, depFile; depFile = file.deps[i++];)
    files.push.apply(files, buildDep(depFile, file.package));

  files.push(file);

  return files;
}
