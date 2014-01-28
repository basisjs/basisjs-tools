
var path = require('path');
var fs = require('fs');
var commander = require('commander');

//
// export
//

module.exports = {
  command: command,
  apply: apply,
  norm: norm
};

var topics = ['app', 'module', 'type'];

//
// main part
//

function command(args, config, action){
  var command = apply(commander.command('create'));

  if (config)
  {
    command.base = path.resolve(config._configPath || '');
    if ('l10n' in config)
      command.l10n = !!config.l10n;
    command._paths = config.path;
    command.appName = config.appName || 'app';
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
  var starIndex = 0;
  return command
    .description('Creates an app')

    .usage('basis create topic name')

    //.option('-b, --base <path>', 'base path for path resolving (current path by default, can be set for topic other than app)', path.resolve)
    //.option('-o, --output <folder_name>', 'folder for output')
    .option('-a, --app-name <name>', 'name of top namespace represents application (shouldn\'t be basis, app by default)', 'app')
    .option('-n, --name <name>', 'name of module or type')
    .option('-l, --l10n', 'use localization')
    .option('-t, --template <name>', 'name of template', 'default')
    .option('--type <name>', 'type name that could be used in topic content')
    .option('--no-git', 'don\'t use git for some reasons')

    .on('*', function(args){
      //console.log('[DEBUG] star rule:', args);
      for (var i = 0; i < args.length; i++)
      {
        var value = args[i];
        switch (i)
        {
          case 0:
            if (topics.indexOf(value) == -1)
            {
              console.warn(value + ' is wrong value for topic; it could be ' + topics.join(', '));
              process.exit();
            }
            else
            {
              this.topic = value;
              if (value == 'app')
                this.name = 'app';
            }
            break;

          case 1:
            if (this.topic == 'app')
              this.output = value;
            else
            {
              if (this.topic == 'type' && !/[A-Z]/.test(value.charAt(0)))
              {
                console.warn('Type name must begins with capital letter:', value);
                process.exit();
              }
              this.name = value;
            }
            break;

          case 2:
            if (this.topic == 'app')
            {
              this.name = value;
              break;
            }

          default:
            console.warn('argument with index ' + i + ' (' + value + ') can\'t be assign to anything');
            process.exit();
        }
      }
    });
}

function norm(options){

  if (options.topic == 'app')
  {
    if (!options.output)
    {
      options.output = '.'; // create app in current directory by default
      //console.warn('Output path is not specified');
      //process.exit();
    }
    if (options.name == 'basis')
    {
      console.warn('Application name couldn\'t be `basis`');
      process.exit();
    }
    if (!options.name)
      options.name = 'app';
  }


  if (!options.name)
  {
    console.warn('Name is not specified');
    process.exit();
  }

  if (!/^[a-z\_$][a-z0-9\_$]*$/i.test(options.name))
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
