
var commander = require('commander');

// fetch version
commander.version(
  require('./package').version,
  '-v, --version'
);

// attach commands
require('./build').command('build');
require('./server').command('server');

// check arguments
var args = process.argv;
if (args.length < 3)
{
  console.warn('Command required, use -h ot --help to get help');
  process.exit();
}

if (!/^-/.test(args[2]) && commander.commands.map(function(cmd){ return cmd.name }).indexOf(args[2]) == -1)
{
  console.warn('Unknown command', args[2]);
  process.exit();
}

// parse arguments
commander.parse(args);
