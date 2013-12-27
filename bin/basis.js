#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var commander = require('commander');
var configPath;

defineCommand('build');
defineCommand('server');
defineCommand('extract', '../lib/extractor');
defineCommand('create');
defineCommand('l10n');
defineCommand('here', null, {
  noConfig: true
});

commander.name = 'basis';
commander
  // fetch version
  .version(
    require('../package.json').version,
    '-v, --version'
  )
  .option('-n, --no-config', 'don\'t use basis.config')
  .option('-c, --config-file <filename>', 'set config filename (if not set search for basis.config from current folder up to top)')
  .on('*', function(args){
    console.warn('Unknown command', args[0]);
    process.exit();
  });

// check arguments
var args = process.argv;
if (args[2] == 'completion')
{
  require('./completion').call();
}

if (args.length < 3)
{
  console.warn('Command required, use -h or --help to get help');
  process.exit();
}

// parse arguments
commander.parse(args);

//
// helpers
//

function fetchConfig(filename){
  var fileContent;
  var result;

  filename = path.resolve(filename);
  console.log('Use config: ', filename);

  try {
    fileContent = fs.readFileSync(filename, 'utf-8');
  } catch(e) {
    console.warn('Config read error: ' + e);
    process.exit();
  }

  try {
    result = JSON.parse(fileContent);
  } catch(e) {
    console.warn('Config parse error: ' + e);
    process.exit();
  }

  configPath = path.dirname(filename);

  return result;
}

function searchConfig(notRequired){
  var curpath = process.cwd().split(path.sep);
  while (curpath.length)
  {
    var cfgFile = curpath.join(path.sep) + path.sep + 'basis.config';

    if (fs.existsSync(cfgFile))
      return fetchConfig(cfgFile);

    curpath.pop();
  }
  if (!notRequired)
    console.warn('Config file basis.config not found');
}

function defineCommand(name, module, options){
  if (!module)
    module = '../lib/' + name;

  if (!options)
    options = {};

  commander.on(name, function(a, b){
    var config;
    
    if (!options.noConfig && this.config)
      config = this.configFile ? fetchConfig(this.configFile) : searchConfig(name == 'create');

    config = (config && config[name]) || {};
    config._configPath = configPath;
      
    require(module).command([name, ''].concat(a, b), config);
  });
}
