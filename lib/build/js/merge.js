
module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  if (flow.options.jsSingleFile)
  {
    // make one package
    for (var i = 0, file; file = queue[i]; i++)
      if (file.type == 'script' && file.package)
      {
        var rootFile = flow.js.rootNSFile[file.package];
        if (rootFile && rootFile.isBasisModule)
        {
          fconsole.log('basis <- ' + file.package + ' (' + file.relpath + ')');
          file.package = 'basis';
        }
      }
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Don\'t use --no-js-single-file or --no-single-file to allow javascript file merge.');
  }

}

module.exports.handlerName = '[js] Merge';
