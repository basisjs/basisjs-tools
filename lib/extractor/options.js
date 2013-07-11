var path = require('path');
var commander = require('commander');

//
// export
//

module.exports = {
  command: command,
  apply: apply,
  norm: norm
};

//
// main part
//

var targets = ['input-graph', 'file-map']; // last is default
var handlers = {
  target: function(target){
    target = String(target).toLowerCase();

    if (targets.indexOf(target) == -1)
      return 'fs';

    return target;
  }
}

function command(args, config, action){
  var command = apply(commander.command('extract <file>'));

  if (config)
  {
    if (config._configPath)
      config.base = path.resolve(config._configPath, config.base || '');
    for (var key in config)
    {
      if (hasOption(command, key))
      {
        if (key == 'file' || key == 'output')
          config[key] = path.resolve(config._configPath, config[key]);

        command[key] = config[key];

        if (handlers.hasOwnProperty(key))
          handlers[key].call(command, config);
      }
      else
      {
        if (key == 'preprocess' || key == 'writeFile')
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
  return command
    .description('Extract file graph')

    .option('-b, --base <path>', 'Base input path for path resolving (current path by default)', path.resolve)
    .option('-f, --file <filename>', 'File name of file to extract, resolve from base path (index.html by default)', path.resolve, 'index.html')
    .option('-o, --output <path>', 'Path for output, resolve from file path (current folder by default)', path.resolve, '.')

    .option('-t, --target <target>', 'Define what extractor should produce. Target could be: ' + targets.join(', ') + ' (file map by default).', handlers.target, targets[targets.length - 1])

    .option('--js-cut-dev', 'Remove code marked as debug from javascript source (cut off lines after ;;; and /** @cut .. */)')
    
    .option('--css-info', 'Collect css names info from html, style and templates')
    .option('--l10n-info', 'Collect l10n keys and dictionaries')
    
    .on('*', function(args){
      //console.log('[DEBUG] star rule:', args);
      this.file = path.resolve(args[0]);
    });
}

function norm(options){
  // pathes
  options.file = path.normalize(path.resolve(options.file));
  options.base = path.normalize((options.base ? path.resolve(options.base) : path.dirname(options.file)) + '/');
  options.output = path.normalize(path.resolve(options.output) + '/');

  if (typeof options.writeFile != 'boolean')
    options.writeFile = true;

  // process preprocessing handlers
  if (!options.preprocess)
    options.preprocess = {};

  for (var type in options.preprocess)
  {
    var handlerList = options.preprocess[type];

    if (!Array.isArray(handlerList))
    {
      if (typeof handlerList == 'string')
        handlerList = [handlerList];
      else
        handlerList = [];

      options.preprocess[type] = handlerList;
    }

    options.preprocess[type] = handlerList.map(function(fn){
      return path.normalize(path.resolve(fn));
    });
  }

  return options;
}
