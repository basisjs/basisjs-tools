
var path = require('path');
var commander = require('commander');

//
// export
//

module.exports = {
  command: command,
  apply: apply,
  norm: norm
};

//
// main part
//

function command(args, config, action){
  var command = apply(commander.command('server'), args);

  if (config)
  {
    config.base = path.resolve(config._configPath, config.base);
    for (var key in config)
    {
      if (hasOption(command, key))
        command[key] = config[key];
    }

    if (config.ignore)
      command.ignore = config.ignore;
    if (config.rewrite)
      command.rewrite = config.rewrite;
  }

  command.parse(args || process.argv);
  action(command);

  return command;
}

function hasOption(command, name){
  for (var i = 0, option; option = command.options[i]; i++)
    if (name == option.name().replace(/-([a-z])/ig, function(m, l){ return l.toUpperCase(); }))
      return true;
}

function apply(command){
  return command
    .version('0.0.1', '-v, --version')
    .description('Launch a http server')

    .option('-b, --base <path>', 'base path for path resolving (current path by default)', path.resolve)
    .option('-p, --port <n>', 'listening port (default 8000)', Number, 8000)
}

function norm(options){
  options.base = path.normalize(path.resolve(options.base) + '/'); // [base]

  return options;
}
