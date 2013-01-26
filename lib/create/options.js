
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
    .description('Creates an app')

    .option('-b, --base <path>', 'Base path for path resolving (current path by default)', path.resolve)
    .option('-o, --output <folder_name>', 'Folder for output')
    .option('-n, --name <name>', 'Name of top namespace represents application (shouldn\'t be basis, app by default)', 'app')

    .on('*', function(args){
      //console.log('[DEBUG] star rule:', args);
      this.output = args[0];
    });
}

function norm(options){
  if (options.name == 'basis')
  {
    console.warn('Application name couldn\'t be `basis`');
    process.exit();
  }

  if (!/^[a-z\_$][a-z0-9\_$]+$/i.test(options.name))
  {
    console.warn('Application name has wrong symbols:', options.name);
    process.exit();
  }

  if (/[\/\\]/.test(options.output))
  {
    console.warn('output should be a folder name, but not the path:', options.output);
    process.exit();
  }

  options.base = path.normalize(options.base + '/'); // [base]
  options.output = path.normalize(path.resolve(options.output));

  return options;
}
