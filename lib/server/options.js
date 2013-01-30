
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
  var command = apply(commander.command('server'));

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
    if (config.handler)
      command.handler = config.handler;
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
    .description('Launch a http server')

    .option('-b, --base <path>', 'base path for path resolving (current path by default)', path.resolve)
    .option('-p, --port <n>', 'listening port (default 8000)', Number, 8000)
    .option('-n, --no-sync', 'don\'t listen fs changes')
    .option('--no-dev', 'don\'t start developer server')
    .option('-i, --index <relpath>', 'build index file on start which contains all .js, .css and .json files for path (relative to base)')
    .option('--no-cache', 'don\'t use any cache')
    .option('--no-res-cache', 'don\'t use resource map for hot start')
    .option('--no-read-cache', 'don\'t use read file content')
    .option('--no-dot-filename-ignore', 'don\'t ignore filenames starting with dot')
}

function norm(options){
  options.base = path.normalize(path.resolve(options.base) + '/'); // [base]

  if (!options.cache)
  {
    options.readCache = false;
    options.resCache = false;
  }

  if (options.index)
    options.index = path.normalize(path.resolve(options.base, options.index) + '/');

  if (isNaN(options.port))
    options.port = 0;

  if (Array.isArray(options.ignore))
  {
    options.ignore = options.ignore.map(function(p){
      return path.resolve(options.base, p);
    });
  }
  else
    options.ignore = [];

  if (!Array.isArray(options.handler))
    if (typeof options.handler == 'string')
      options.handler = [options.handler];
    else
      options.handler = null;

  if (options.handler)
    options.handler = options.handler.map(function(fn){
      return path.normalize(path.resolve(fn));
    });

  return options;
}
