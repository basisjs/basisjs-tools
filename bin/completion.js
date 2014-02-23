var fs = require('fs');

module.exports = function(command, args){
  if (!args.length)
  {
    if (process.platform === 'win32')
      throw new Error('command completion not supported on windows');

    console.log(fs.readFileSync(__dirname + '/completion.sh', 'utf8'));
    process.exit(0);
  }

  console.log((command.parse(args.slice(1), true) || []).join('\n'));
  process.exit(0);
};
