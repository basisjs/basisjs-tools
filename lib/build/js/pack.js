var exec = require('child_process').exec;
var processor = '';

module.exports = function(flow, startFn, doneFn){
  var packages = flow.js.packages;
  var queue = flow.files.queue;
  var fconsole = flow.console;

  if (flow.options.jsPack)
  {
    processor = '';
    startFn();
    var command = flow.options.jsPackCmd || 'google-closure-compiler --charset UTF-8';
    // check command is works
    exec(
      'echo "" | ' + command,
      function(error, stdout, stderr){
        var processFile = cmdProcess;

        // if command doesn't work
        if (error)
        {
          if (flow.options.jsPackCmd)
          {
            flow.warn({
              fatal: true,
              message:
                'Pack command: `' + flow.options.jsPackCmd + '`\n' +
                error
            });
            process.exit();
          }

          flow.warn({ message: '[WARN] `google-closure-compiler` is not available, downgrade to uglify.js' });
          processFile = uglifyProcess;
          processor = 'uglify-js';
        }
        else
        {
          if (flow.options.jsPackCmd)
            processor = flow.options.jsPackCmd;
          else
            processor = 'google-closure-compiler';
        }

        // process files
        fconsole.start();
        for (var i = 0, file; file = queue[i]; i++)
          if (file.type == 'script' && file.htmlNode && file.outputContent)
            processFile(file, flow, command, startFn, doneFn);

        doneFn();
      }
    );
  }
  else
  {
    fconsole.log('Skiped.');
    fconsole.log('Use --js-pack or --pack to allow javascript file compess.');
  }
};

module.exports.handlerName = '[js] Compress';
module.exports.extraInfo = function(flow){
  return processor;
};

function cmdProcess(file, flow, command, startFn, doneFn){
  var packStartTime = new Date;
  var fconsole = flow.console;
  var gcc;

  fconsole.log('Init compression for ' + file.relOutputFilename);
  gcc = exec(
    command, {
      maxBuffer: 10 * 1024 * 1024
    }, function(error, stdout, stderr){
      fconsole.log(file.relOutputFilename + ' compressed in ' + ((new Date - packStartTime) / 1000).toFixed(3) + 's');

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
  gcc.stdin.on('error', function(error){
    flow.warn({
      fatal: true,
      message:
        'Pack command: `' + command + '`\n' +
        error
    });
  });
  gcc.stdin.write(file.outputContent);
  gcc.stdin.end();
}

function uglifyProcess(file, flow, command, startFn, doneFn){
  flow.console.log('Compress ' + file.relOutputFilename);
  file.outputContent = require('uglify-js')(file.outputContent);
}
