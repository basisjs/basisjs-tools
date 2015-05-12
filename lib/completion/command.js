var clap = require('clap');
var fs = require('fs');
var exit = require('exit');

function complete(program, args){
  if (!args.length)
  {
    if (process.platform === 'win32')
    {
      console.error('Command completion not supported on Windows');
      exit(2);
    }

    console.log(fs.readFileSync(__dirname + '/completion.sh', 'utf8'));
    exit();
  }

  if (!program)
  {
    console.error('Program for completion is not set');
    exit(2);
  }

  console.log((program.parse(args.slice(1), true) || []).join('\n'));
  exit();
};

module.exports = clap.create('completion')
  .description('Output completion script for *nix systems')
  .action(function(args, literalArgs){
    complete(this.context.program, literalArgs);
  });
