
module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  // this option is not supported for now
  if (flow.options.jsSingleFile)
  {
    // ...
  }
  else
  {
    fconsole.log('Skiped.');
    fconsole.log('Don\'t use --no-js-single-file or --no-single-file to allow javascript file merge.');
  }
};

module.exports.handlerName = '[js] Merge';
