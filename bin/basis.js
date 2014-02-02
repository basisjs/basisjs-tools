#!/usr/bin/env node

var path = require('path');
var fs = require('fs');

// ==============================
// Check for newer version of basisjs-tools
global.start = new Date;
// var notifier = require('update-notifier')({
//   packagePath: '../package.json'
// });

// if (notifier.update)
//   notifier.notify();
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
    
    var options = this.values;

    if (options.config)
    {
      var config = options.configFile
        ? fetchConfig(options.configFile)
        : searchConfig();
      this.config = config.data;
      this.configFile = config.path;
    }
  });

defineCommand('build');
defineCommand('server');
defineCommand('extract', '../lib/extractor');
defineCommand('create');

// reg completion command
program
  .command('completion')
    .description('Output completion script for *nix systems')
    .action(function(args){
      require('./completion')(program, args);
    });

// parse arguments
program.parse();

//
// helpers
//

function fetchConfig(filename){
  var fileContent;
  var data;

  filename = path.resolve(filename);
  console.log('Use config: ', filename + '\n');

  try {
    fileContent = fs.readFileSync(filename, 'utf-8');
  } catch(e) {
    console.error('Config read error: ' + e);
    process.exit();
  }

  try {
    data = JSON.parse(fileContent);
  } catch(e) {
    console.error('Config parse error: ' + e);
    process.exit();
  }

  return {
    path: path.dirname(filename),
    data: data
  };
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
}

function defineCommand(name, module){
  if (!module)
    module = '../lib/' + name;

  var moduleOptions = require(module + '/options.js');
  moduleOptions
    .createCommand(program)
    .init(function(){
      var config = this.parent.config;

      if (config)
      {

        var data = config[this.name] || {};
        data._configPath = this.parent.configFile;

        moduleOptions.applyConfig(this, data);
      }
    })
    .action(function(){
      // module lazy load
      require(module).commandAction.call(this);
    });
}
