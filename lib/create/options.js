
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
    config.base = path.resolve(config._configPath, config.base);
    if ('l10n' in config)
      command.l10n = !!config.l10n;
    command._pathes = config.pathes;
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

    .option('-b, --base <path>', 'base path for path resolving (current path by default, can be set for topic other than app)', path.resolve)
    //.option('-o, --output <folder_name>', 'folder for output')
    .option('-n, --name <name>', 'name of top namespace represents application (shouldn\'t be basis, app by default)')
    .option('-l, --l10n', 'use localization')
    .option('-t, --template <name>', 'name of template', 'default')

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
              this.name = value;
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

require('colors');
function norm(options){
  if (options.topic == 'app')
  {
    if (options.name == 'basis')
    {
      console.warn('Application name couldn\'t be `basis`'.red);
      process.exit();
    }
    if (!options.name)
      options.name = 'app';
  }

  if (!options.name)
  {
    console.warn('Name is not specified'.red);
    process.exit();
  }

  if (!/^[a-z\_$][a-z0-9\_$]+$/i.test(options.name))
  {
    console.warn('Application name has wrong symbols:', options.name.red);
    process.exit();
  }

  options.base = path.normalize(path.resolve(options.base) + '/'); // [base]

  // resolve output dir
  var pathes = options._pathes || {};
  switch (options.topic)
  {
    case 'module':
      options.output = path.resolve(options.base, pathes.module || '');
    break;
    case 'type':
      options.output = path.resolve(options.base, pathes.type || '');
      options.index = pathes.typeIndex ? path.resolve(options.base, pathes.typeIndex) : false;
    break;
    default:
      options.output = path.resolve(options.output);
  }
  options.outputDir = path.normalize(options.output);

  // resolve input dir
  options.templateDir = __dirname + '/template/' + options.topic + '/' + options.template;
  if (!fs.existsSync(options.templateDir))
  {
    console.warn(options.topic + ' template ' + options.template.bold + ' not found (' + options.templateDir + ')');
    process.exit();
  }


  return options;
}
