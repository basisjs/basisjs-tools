
var path = require('path');
var fs = require('fs');
var cli = require('../cli');




//
// main part
//


function applyConfig(command, config){
  command.values.base = path.resolve(config._configPath || '');

  if ('l10n' in config)
    command.values.l10n = !!config.l10n;

  command.values._paths = config.path;
  command.values.appName = config.appName || 'app';

  return command;
}

function normOptions(options){

  if (options.topic == 'app')
  {
    if (!options.output)
    {
      options.output = '.'; // create app in current directory by default
      //console.warn('Output path is not specified');
      //process.exit();
    }
    // if (options.name == 'basis')
    // {
    //   console.warn('Application name couldn\'t be `basis`');
    //   process.exit();
    // }
    // if (!options.name)
    //   options.name = 'app';
  }


  if (!options.name)
  {
    console.warn('Name is not specified');
    process.exit();
  }

  if (!/^[a-z\_$][a-z0-9\_\-$]*$/i.test(options.name))
  {
    console.warn('Topic name has wrong symbols:', options.name);
    process.exit();
  }

  options.base = path.normalize(path.resolve(options.base) + '/'); // [base]

  // resolve output dir
  var paths = options._paths || {};
  switch (options.topic)
  {
    case 'module':
      options.output = path.resolve(options.base, paths.module || '');
    break;
    case 'type':
      options.output = path.resolve(options.base, paths.type || '');
      options.index = paths.typeIndex ? path.resolve(options.base, paths.typeIndex) : false;
    break;
    default:
      options.output = path.resolve(options.output);
  }
  options.outputDir = path.normalize(options.output);

  // resolve input dir
  options.templateDir = __dirname + '/template/' + options.topic + '/' + options.template;
  if (!fs.existsSync(options.templateDir))
  {
    console.warn(options.topic + ' template ' + options.template + ' not found (' + options.templateDir + ')');
    process.exit();
  }


  return options;
}

var command = cli.create('create')
  .description('Generate code of app, module or type')
  //.option('-b, --base <path>', 'base path for path resolving (current path by default, can be set for topic other than app)', path.resolve)
  //.option('-o, --output <folder_name>', 'folder for output')
  .option('-l, --l10n', 'use localization')

  .init(function(){
    if (this.config)
    {
      var data = this.config[this.name] || {};
      data._configPath = this.configFile;
      applyConfig(this, data);
    }
  })
  .delegate(function(nextCommand){
    if (this.config)
    {
      var data = this.config[this.name] || {};
      data._configPath = this.configFile;
      applyConfig(nextCommand, data);
    }
  });

// create app
command.command('app', '[output] [name]')
  .description('Create an application')
  .option('-o, --output <folder_name>', 'folder for output')
  .option('--no-git', 'don\'t init git repository')
  .option('-n, --name <name>',
    'name of top namespace represents application (shouldn\'t be basis, app by default)',
    function(name){
      if (name == 'basis')
        throw new Error('Application name shouldn\'t be `basis`');
      return name;
    },
    'app'
  )
  .option('-t, --template <name>', 'name of template', 'default')
  .args(function(args){
    if (args[0])
      this.setOption('output', args[0]);
    if (args[1])
      this.setOption('name', args[1]);
  })
  .action(function(){
    require('./index.js').create.call(this, 'app', this.values);
  });

// create module
command.command('module', '[name]')
  .description('Create a module')
  .option('-n, --name <name>', 'name of module')
  .option('-t, --template <name>', 'name of template', 'default')
  .option('-T, --type <name>', 'type name that should be used by module')
  .args(function(args){
    this.setOption('name', args[0]);
  })
  .action(function(){
    require('./index.js').create.call(this, 'module', this.values);
  });

// create type
command.command('type')
  .description('Create a data type')
  .option('-n, --name <name>', 'name of type')
  .option('-t, --template <name>', 'name of template', 'default')
  .args(function(args){
    var name = args[0];

    if (!/[A-Z]/.test(name.charAt(0)))
      throw new Error('Type name should begins with capital letter:', name);

    this.setOption('name', name);
  })
  .action(function(){
    require('./index.js').create.call(this, 'type', this.values);
  });

module.exports = command;
module.exports.norm = normOptions;
