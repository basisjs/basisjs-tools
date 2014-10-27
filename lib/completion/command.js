var clap = require('clap');
var fs = require('fs');

function complete(program, args){
  if (!args.length)
  {
    if (process.platform === 'win32')
    {
      console.error('Command completion not supported on Windows');
      process.exit(1);
    }

    console.log(fs.readFileSync(__dirname + '/completion.sh', 'utf8'));
    process.exit();
  }

  if (!program)
  {
    console.error('Program for completion is not set');
    process.exit(1);
  }

  console.log((program.parse(args.slice(1), true) || []).join('\n'));
  process.exit();
};

module.exports = clap.create('completion')
  .description('Output completion script for *nix systems')
  .action(function(args, literalArgs){
    complete(this.program, literalArgs);
  });
