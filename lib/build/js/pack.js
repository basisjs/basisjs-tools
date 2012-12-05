
module.exports = function(flow, startFn, doneFn){
  var packages = flow.js.packages;
  var queue = flow.files.queue;
  var fconsole = flow.console;

  if (flow.options.jsPack)
  {
    for (var i = 0, file; file = queue[i]; i++)
      if (file.type == 'script' && file.outputContent)
      {
        fconsole.log('Init compression for ' + file.relOutputFilename);
        runProcess(file, fconsole, startFn, doneFn);
      }
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Use --js-pack or --pack to allow javascript file compess.');
  }
}

module.exports.handlerName = '[js] Compress';

function runProcess(file, fconsole, startFn, doneFn){
  var packStartTime = new Date;
  var gcc = require('child_process').exec(
    'gcc --charset UTF-8',
    {
      maxBuffer: 10 * 1024 *1024
    },
    function(error, stdout, stderr){
      fconsole.log(file.relOutputFilename + ' compressed in ' + ((new Date - packStartTime)/1000).toFixed(3) + 's');

      if (stderr && stderr.length)
        fconsole.log(stderr);

      if (error !== null)
        fconsole.log('exec error: ' + error);
      else
        file.outputContent = stdout;

      doneFn();
    }
  );

  startFn();
  gcc.stdin.write(file.outputContent);
  gcc.stdin.end();
}