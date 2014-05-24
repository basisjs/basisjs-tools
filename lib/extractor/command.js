var path = require('path');
var clap = require('clap');


var targets = ['input-graph', 'file-map']; // last is default
var handlers = {
  target: function(target){
    target = String(target).toLowerCase();

    if (targets.indexOf(target) == -1)
      return 'fs';

    return target;
  }
};

function applyConfig(command, config){
  if (config._configPath)
    command._configPath = config._configPath;

  if (config)
  {
    for (var name in config)
    {
      if (command.hasOption(name))
      {
        if (name == 'file' || name == 'output' || name == 'base')
          config[name] = path.resolve(config._configPath, config[name]);

        command.setOption(name, config[name]);
      }
      else
      {
        if (name == 'preprocess' || name == 'extFileTypes')
          command.values[name] = config[name];
        else
        {
          if (name != '_configPath')
            console.warn('Unknown option `' + name + '` in config (ignored)');
        }
      }
    }
  }

  return command;
}

function normOptions(options){
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
      return path.normalize(path.resolve(module.exports._configPath || '.', fn));
    });
  }

  return options;
}

module.exports = clap.create('extract', '[file]')
  .description('Extract file graph')

  .init(function(){
    if (this.config)
    {
      var data = this.config['build'] || {};
      data._configPath = this.configPath;
      applyConfig(this, data);
    }
  })

  .option('-b, --base <path>',
    'Base input path for path resolving (current path by default)'
  )
  .option('-f, --file <filename>',
    'File name of file to extract, resolve from base path (index.html by default)',
    function(filename){
      this.setOption('base', null);
      return filename;
    },
    'index.html'
  )
  .option('-o, --output <path>',
    'Path for output, resolve from file path (current folder by default)',
    '.'
  )

  .option('-t, --target <target>',
    'Define what extractor should produce. Target could be: ' + targets.join(', ') + ' (file map by default).',
    handlers.target,
    targets[targets.length - 1]
  )

  .option('--js-cut-dev', 'Remove code marked as debug from javascript source (cut off lines after ;;; and /** @cut .. */)')

  .option('--css-info', 'Collect css names info from html, style and templates')
  .option('--l10n-info', 'Collect l10n keys and dictionaries')

  .args(function(filename){
    this.setOption('file', filename);
  })

  .action(function(){
    if (this.configFile)
      console.log('Use config: ' + this.configFile + '\n');

    require('./index.js').extract.call(this, this.values);
  });

module.exports.norm = normOptions;
