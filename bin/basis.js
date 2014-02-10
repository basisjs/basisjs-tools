#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var cli = require('../lib/cli');

var silent = false;

// ==============================
// Check for newer version of basisjs-tools
// var notifier = require('update-notifier')({
//   packagePath: '../package.json'
// });

// if (notifier.update)
//   notifier.notify();
// ==============================


//
// helpers
//

function fetchConfig(filename){
  var fileContent;
  var data;

  filename = path.resolve(filename);

  if (!silent)
    console.log('Use config: ', filename + '\n');

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
      var config = options.configFile
        ? fetchConfig(options.configFile)
        : searchConfig();

      if (config)
      {
        nextCommand.config = config.data;
        nextCommand.configFile = config.path;
      }
    }
  })
  .action(function(){
    this.showHelp();
  });

program.command(require('../lib/extractor/command.js'));
program.command(require('../lib/build/command.js'));
program.command(require('../lib/server/command.js'));
program.command(require('../lib/create/command.js'));

// reg completion command
program.command('completion')
  .description('Output completion script for *nix systems')
  .action(function(args, literalArgs){
    silent = true;
    require('./completion')(program, literalArgs);
  });

// parse arguments
//try {
  program.run();
//} catch(e) {
//  console.error('Error:', e.message || e);
//  process.exit(1);
//}