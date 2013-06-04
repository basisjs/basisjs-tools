
module.exports = function(flow, startFn, doneFn){
  var packages = flow.js.packages;
  var queue = flow.files.queue;
  var fconsole = flow.console;

  if (flow.options.jsPack)
  {
    for (var i = 0, file; file = queue[i]; i++)
      if (file.type == 'script' && file.htmlNode && file.outputContent)
      {
        fconsole.log('Init compression for ' + file.relOutputFilename);
        runProcess(file, flow, startFn, doneFn);
      }
  }
  else
  {
    fconsole.log('Skiped.')
    fconsole.log('Use --js-pack or --pack to allow javascript file compess.');
  }
}

module.exports.handlerName = '[js] Compress';

function runProcess(file, flow, startFn, doneFn){
  var packStartTime = new Date;
  var fconsole = flow.console;
  var gcc = require('child_process').exec(
    flow.options.jsPackCmd || 'google-closure-compiler --charset UTF-8',
    {
      maxBuffer: 10 * 1024 * 1024
    },
    function(error, stdout, stderr){
      fconsole.log(file.relOutputFilename + ' compressed in ' + ((new Date - packStartTime)/1000).toFixed(3) + 's');

      if (stderr && stderr.length)
        fconsole.log(stderr.length < 256 ? stderr : stderr.replace(/^((?:.|[\r\n]){128})(?:.|[\r\n])*((?:.|[\r\n]){128})$/, '$1...$2'));

      if (error !== null)
        fconsole.log('exec error: ' + error);
      else
        file.outputContent = stdout.replace(/;[\r\n\s]*$/, '');

      doneFn();
    }
  );

  startFn();
  gcc.stdin.write(file.outputContent);
  gcc.stdin.end();
}