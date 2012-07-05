
module.exports = function(flowData){
  if (flowData.options.jsSingleFile)
  {
    var queue = flowData.files.queue;

    // make one package
    for (var i = 0, file; file = queue[i]; i++)
      if (file.type == 'script' && file.package)
        file.package = 'script';
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Don\'t use --no-js-single-file or --no-single-file to allow javascript file merge.');
  }

}

module.exports.handlerName = '[js] Merge';
