#!/usr/bin/env node
global.start = new Date;
var configPath;
var path = require('path');
var fs = require('fs');

//fs.writeFileSync('complete.log', process.argv.join('\n'));

// ==============================
// Check for newer version of basisjs-tools
var notifier = require('update-notifier')({
  packagePath: '../package.json'
});

if (notifier.update)
  notifier.notify();
// ==============================

var cli = require('../lib/cli').error(function(error){
  console.error('Error:', error);
  process.exit(1);
});
var program = cli
  .create('basis')
  .version(require('../package.json').version)
  .option('-n, --no-config', 'Don\'t use basis.config')
  .option('-c, --config-file <filename>', 'Specify path to config filename')
  .action(function(){
    program.showHelp();
  });

defineCommand('build');
defineCommand('server');
defineCommand('extract', '../lib/extractor');
defineCommand('create');

// reg completion command
program
  .command('completion', 'Output completion script for *nix systems')
    .action(function(command, args){
      require('./completion')(program, args);
    });


// check arguments
//if (args[2] == 'completion')
//  require('./completion').call();

if (process.argv.length < 3)
{
  //program.showHelp();
  //process.exit();
}

// parse arguments
program.parse();

//
// helpers
//

function fetchConfig(filename){
  var fileContent;
  var result;

  filename = path.resolve(filename);
  console.log('Use config: ', filename + '\n');

  try {
    fileContent = fs.readFileSync(filename, 'utf-8');
  } catch(e) {
    console.error('Config read error: ' + e);
    process.exit();
  }

  try {
    result = JSON.parse(fileContent);
  } catch(e) {
    console.error('Config parse error: ' + e);
    process.exit();
  }

  configPath = path.dirname(filename);

  return result;
}

function searchConfig(optional){
  var curpath = process.cwd().split(path.sep);

  while (curpath.length)
  {
    var cfgFile = curpath.join(path.sep) + path.sep + 'basis.config';

    if (fs.existsSync(cfgFile))
      return fetchConfig(cfgFile);

    curpath.pop();
  }

  if (!optional)
    console.error('Config file basis.config required but not found');
}

function defineCommand(name, module, cfg){
  if (!module)
    module = '../lib/' + name;

  if (!cfg)
    cfg = {};

  var moduleOptions = require(module + '/options.js');
  moduleOptions
    .createCommand(program)
    .init(function(){
      var options = program.values;
      var config;

      if (!cfg.noConfig && options.config)
        config = options.configFile ? fetchConfig(options.configFile) : searchConfig(name == 'create');

      config = (config && config[this.name]) || {};
      config._configPath = configPath;

      moduleOptions.applyConfig(this, config);
    })
    .action(function(){
      // module lazy load
      require(module).commandAction(this);
    });
}
