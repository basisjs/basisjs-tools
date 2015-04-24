var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var cli = require('clap');
var ConfigStore = require('./config-store');
var utils = require('./utils');

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
  var currentDir = process.env.PWD || process.cwd(); // use PWD if possible as on *nix process.cwd()
                                                     // returns real path instead of symlink-path;
  var pathParts = path.normalize(currentDir).split(path.sep);

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
  .version(utils.getToolsId(true))
  .option('-n, --no-config', 'Don\'t use basis.config')
  .option('-c, --config-file <filename>', 'Specify path to config filename')
  .delegate(function(nextCommand){
    // special case for completion command
    if (nextCommand.name == 'completion')
    {
      this.context.program = program;
      silent = true;
      return;
    }

    var options = this.values;
    if (options.config)
    {
      var globalConfig = getGlobalConfig();
      var config = options.configFile
        ? fetchConfig(options.configFile)
        : searchConfig();

      if (config)
      {
        this.context.config = config.data;
        this.context.configFile = config.filename;
        this.context.configPath = config.path;
      }

      this.context.globalConfig = globalConfig;
    }
  })
  .action(function(){
    this.showHelp();
  });

program.Error = cli.Error;
program.setGlobalConfig = function(config){
  globalConfig = config;
};


//
// registrate commands
//

program.command(require('./completion/command'));
program.command(require('./config/command'));

program.command(require('./extract/command'));
program.command(require('./build/command'));
program.command(require('./lint/command'));
program.command(require('./server/command'));
program.command(require('./create/command'));


module.exports = program;
