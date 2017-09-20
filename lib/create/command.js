var path = require('path');
var fs = require('fs');
var clap = require('clap');
var exit = require('exit');


function applyConfig(command, config, configPath){
  command.values.base = path.resolve(configPath || '');

  if ('l10n' in config)
    command.values.l10n = !!config.l10n;

  command.values._configPath = configPath;
  command.values._paths = config.path;
  command.values.templates = config.templates;
  command.values.appName = config.appName || 'app';

  return command;
}

function normOptions(options){

  if (options.topic == 'app')
  {
    if (!options.output)
    {
      options.output = '.'; // create app in current directory by default
    }
  }

  if (!options.name)
  {
    console.error('Name is not specified');
    exit(2);
  }

  if (!/^[a-z\_$][a-z0-9\_\-$]*$/i.test(options.name))
  {
    console.error('Topic name has wrong symbols:', options.name);
    exit(2);
  }

  options.base = path.normalize(path.resolve(options.base || '') + '/'); // [base]

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
  options.templates = (options.templates || [])
    .concat(__dirname + '/template/')
    .map(function(dir){
      return path.resolve(options._configPath || options.base, dir);
    });

  return options;
}

var command = clap.create('create')
  .description('Code generator')
  .option('-b, --base <path>', 'Base path for relative path resolving (current path by default)', '.')
  //.option('--output <folder_name>', 'folder for output')
  .option('-l, --l10n', 'Use localization')

  .init(function(){
    var config = this.context.config = this.root.getConfig();
    if (config)
      applyConfig(this, config.data[this.name] || {}, config.path);
  })
  .action(function(){
    this.showHelp();
  })
  .delegate(function(nextCommand){
    var config = this.context.config;
    if (config)
      applyConfig(nextCommand, config.data[this.name] || {}, config.path);
  });

// create app
command.command('app', '[output] [name]')
  .description('Create an application')
  .option('--no-git', 'Don\'t init git repository')
  .option('-b, --base <path>', 'Base path for relative path resolving (current path by default)', '.')
  .option('-o, --output <folder>', 'Folder for output (current path by default)')
  .option('-t, --template <name>', 'Name of template', 'default')
  .option('-n, --name <name>',
    'Name of root namespace represents application (app by default)',
    function(name){
      if (name == 'basis')
        throw new Error('Application name shouldn\'t be `basis`');
      return name;
    },
    'app'
  )
  .args(function(args){
    var output = args[0];
    var name = args[1];

    if (output)
      this.setOption('output', output);
    if (name)
      this.setOption('name', name);
  })
  .action(function(){
    require('./index.js').create.call(this, 'app', this.values);
  });

// create module
command.command('module', '[name]')
  .description('Create a module')
  .option('-b, --base <path>', 'Base path for relative path resolving (current path by default)', '.')
  .option('-t, --template <name>', 'Name of template', 'default')
  .option('-n, --name <name>', 'Name of module')
  .option('-a, --app-name <name>', 'App root namespace')
  .option('-T, --type <name>', 'Type name that should be used by module')
  .args(function(args){
    var name = args[0];

    this.setOption('name', name);
  })
  .action(function(){
    var config = this.context.config;

    if (config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    require('./index.js').create.call(this, 'module', this.values);
  });

// create type
command.command('type', '[name]')
  .description('Create a data type')
  .option('-b, --base <path>', 'Base path for relative path resolving (current path by default)', '.')
  .option('-t, --template <name>', 'Name of template', 'default')
  .option('-n, --name <name>', 'Name of type')
  .option('-a, --app-name <name>', 'App root namespace')
  .args(function(args){
    var name = args[0];

    if (!/[A-Z]/.test(name.charAt(0)))
      throw new Error('Type name should begins with capital letter:', name);

    this.setOption('name', name);
  })
  .action(function(){
    var config = this.context.config;

    if (config && config.filename)
      console.log('Config: ' + config.filename + '\n');

    require('./index.js').create.call(this, 'type', this.values);
  });

module.exports = command;
module.exports.norm = normOptions;
