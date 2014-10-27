var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var cli = require('clap');
var ConfigStore = require('./config-store');

var silent = false;
var globalConfig = null;


//
// global config
//

function getGlobalConfig(){
  if (!globalConfig)
  {
    globalConfig = new ConfigStore('basisjs-tools');

    // migrate config (basis [prior 1.3.18] -> basisjs-tools [in 1.3.18+])
    if (ConfigStore.exists('basis'))
    {
      var oldConfig = new ConfigStore('basis');
      globalConfig.values = oldConfig.values;
      fs.unlink(oldConfig.path);
    }
  }

  return globalConfig;
}


//
// project config
//

function fetchConfig(filename){
  var fileContent;
  var data;

  filename = path.resolve(filename);

  try {
    fileContent = fs.readFileSync(filename, 'utf-8');
  } catch(e) {
    if (!silent)
      console.error('Config read error: ' + e);
    process.exit(1);
  }

  try {
    data = JSON.parse(fileContent);
  } catch(e) {
    if (!silent)
      console.error('Config parse error: ' + e);
    process.exit(1);
  }

  return {
    filename: filename,
    path: path.dirname(filename),
    data: data
  };
}

function searchConfig(){
  var currentDir = process.env.PWD || process.cwd(); // use PWD if possible as on Mac OS process.cwd()
                                                     // returns real path instead of symlinked path

  var pathParts = currentDir.split(path.sep);
  while (pathParts.length)
  {
    var cfgFile = pathParts.join(path.sep) + path.sep + 'basis.config';

    if (fs.existsSync(cfgFile))
      return fetchConfig(cfgFile);

    pathParts.pop();
  }
}


//
// main part
//

var program = cli.create('basis')
  .version(require('../package.json').version)
  .option('-n, --no-config', 'Don\'t use basis.config')
  .option('-c, --config-file <filename>', 'Specify path to config filename')
  .delegate(function(nextCommand){
    var options = this.values;
    if (options.config && nextCommand.name != 'completion')
    {
      var globalConfig = getGlobalConfig();
      var config = options.configFile
        ? fetchConfig(options.configFile)
        : searchConfig();

      if (config)
      {
        nextCommand.config = config.data;
        nextCommand.configFile = config.filename;
        nextCommand.configPath = config.path;
      }

      nextCommand.globalConfig = globalConfig ? globalConfig.values : {};
    }
  })
  .action(function(){
    this.showHelp();
  });

program.command(require('./extract/command'));
program.command(require('./build/command'));
program.command(require('./server/command'));
program.command(require('./create/command'));

// completion command
// TODO: move to lib/completion
program.command('completion')
  .description('Output completion script for *nix systems')
  .action(function(args, literalArgs){
    silent = true;
    require('../bin/completion')(program, literalArgs);
  });

// config command
// TODO: move to lib/config
program.command('config', '<name> [value]')
  .description('Global configuration')
  .action(function(args){
    var globalConfig = getGlobalConfig();

    if (!globalConfig)
    {
      console.error('Global config is not available');
      process.exit(1);
    }

    if (args.length == 0)
    {
      console.log(JSON.stringify(globalConfig.values, null, 2));
      return;
    }

    var name = args[0];
    if (args.length == 1)
    {
      // read
      console.log('Config value for ' + name + ' is ' + JSON.stringify(globalConfig.get(name)));
    }
    else
    {
      // write
      console.log('Set value ' + chalk.green(JSON.stringify(args[1])) + ' for ' + chalk.green(name));
      globalConfig.set(name, args[1]);
    }
  });

program.Error = cli.Error;
program.setGlobalConfig = function(config){
  globalConfig = config;
};

module.exports = program;
