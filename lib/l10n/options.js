
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

var topics = ['export', 'import'];

//
// main part
//

function command(args, config, action){
  var command = apply(commander.command('build <file>'));

  if (config._configPath)
    command._configPath = config._configPath;

  if (config)
  {
    for (var key in config)
    {
      if (hasOption(command, key))
      {
        if (key == 'file' || key == 'output' || key == 'base')
          config[key] = path.resolve(config._configPath, config[key]);

        command[key] = config[key];

        if (handlers.hasOwnProperty(key))
          handlers[key].call(command, config);
      }
      else
      {
        if (key == 'preprocess' || key == 'extFileTypes')
          command[key] = config[key];
        else
        {
          if (key != '_configPath')
            console.warn('Unknown key `' + key + '` in config ignored');
        }
      }
    }
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
    .description('Work with l10n')

    .usage('basis l10n [export|import]')

    .option('-b, --base <path>', 'Base input path for path resolving (current path by default)', path.resolve)
    .option('-f, --file <filename>', 'File name of file to build, resolve from base path (index.html by default)', function(filename){
      command.base = null;
      return path.resolve(filename);
    }, 'index.html')
    .option('-o, --output <path>', 'Path for output, resolve from file path (build by default)', path.resolve, '.')

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
              console.warn(value + ' is wrong value for topic; it should be ' + topics.join(', '));
              process.exit();
            }
            else
            {
              this.topic = value;
            }
            break;

          default:
            console.warn('argument with index ' + i + ' (' + value + ') can\'t be assign to anything');
            process.exit();
        }
      }
    });
}

function norm(options){
  function addPreprocessors(type, handlerList){
    if (!Array.isArray(handlerList))
    {
      if (typeof handlerList == 'string')
        handlerList = [handlerList];
      else
        handlerList = [];
    }

    handlerList = handlerList.map(function(fn){
      return path.normalize(path.resolve(options._configPath || '.', fn));
    });

    var processors = options.preprocess[type];
    if (processors)
      processors.push.apply(processors, handlerList);
    else
      options.preprocess[type] = handlerList;
  }

  // pathes
  options.file = path.normalize(path.resolve(options.file));
  options.base = path.normalize((options.base ? path.resolve(options.base) : path.dirname(options.file)) + '/');
  options.output = path.normalize(path.resolve(options.output) + '/');

  // process preprocessing handlers
  if (!options.preprocess)
    options.preprocess = {};

  var configExtFileTypes = options.extFileTypes;
  var extFileTypes = {};
  var configPreprocess = options.preprocess;

  options.extFileTypes = extFileTypes;
  options.preprocess = {};

  for (var type in configExtFileTypes)
  {
    var cfg = configExtFileTypes[type];
    extFileTypes[type] = cfg.type;
    if (cfg.preprocess)
      addPreprocessors(type, cfg.preprocess);
  }

  for (var type in configPreprocess)
    addPreprocessors(type, configPreprocess[type]);

  if (!options.topic)
    options.topic = 'export';

  if (options.topic == 'app')
  {
    if (!options.output)
    {
      options.output = '.'; // create app in current directory by default
    }
  }

  options.base = path.normalize(path.resolve(options.base) + '/'); // [base]

  // resolve output dir
  var paths = options._paths || {};
  switch (options.topic)
  {
    case 'export':
      // options.output = path.resolve(options.base, paths.module || '');
    break;
    case 'import':
      // options.output = path.resolve(options.base, paths.type || '');
      // options.index = paths.typeIndex ? path.resolve(options.base, paths.typeIndex) : false;
    break;
    default:
      // options.output = path.resolve(options.output);
  }

  return options;
}
