
var at = require('../../ast').js;

module.exports = function(flow){

  var packages = {};
  var queue = flow.files.queue;
  var fconsole = flow.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && file.package)
    {
      var package = packages[file.package];
      if (!package)
      {
        package = packages[file.package] = [];

        var rootFile = flow.js.rootNSFile[file.package];
        if (rootFile && rootFile.package == file.package && rootFile.package == rootFile.namespace)
          package.layout = 'basis';
      }

      package.push.apply(package, buildDep(file, file.package));
    }

  for (var name in packages)
  {
    fconsole.start('Package `' + name + '`');
    packages[name].forEach(function(file){
      fconsole.log(file.relpath);
    });
    fconsole.endl();
  }

  flow.js.packages = packages;
};

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
