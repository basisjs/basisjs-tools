var fs = require('fs');
var path = require('path');
var ConfigStore = require('./config-store');
var utils = require('./common/utils');
var exit = require('exit');

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
    exit(2);
  }

  try {
    data = JSON.parse(fileContent);
  } catch(e) {
    if (!silent)
      console.error('Config parse error: ' + e);
    exit(2);
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

module.exports = function(command){
  command
    .version(utils.getToolsId(true))
    .option('-n, --no-config', 'Don\'t use basis.config', { hot: true })
    .option('-c, --config-file <filename>', 'Specify path to config filename', { hot: true });

  command.getGlobalConfig = getGlobalConfig;
  command.getConfig = function(options){
    if (!options)
      options = this.values;

    if ('config' in options == false || options.config)
    {
      var config = options.configFile
        ? fetchConfig(options.configFile)
        : searchConfig();

      if (config)
        return config;
    }
  };

  return command;
};
