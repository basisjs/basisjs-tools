var path = require('path');
var clap = require('clap');

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function applyConfig(command, config, configPath){
  command._configPath = configPath;

  if (config)
  {
    for (var name in config)
    {
      if (command.hasOption(name))
      {
        if (name == 'file' || name == 'output' || name == 'base')
          config[name] = path.resolve(configPath, config[name]);

        command.setOption(name, config[name]);
      }
      else
      {
        if (name == 'preprocess' || name == 'extFileTypes')
          command.values[name] = config[name];
        // else
        //   console.warn('Unknown option `' + name + '` in config (ignored)');
      }
    }

    // if no base in config, set config path as base
    if ('base' in config == false)
      command.setOption('base', configPath);
  }

  return command;
}

function normOptions(options){
  // locations
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

module.exports = clap.create('lint', '[file]')
  .description('Lint files')

  .init(function(){
    var config = this.context.config;
    if (config)
      applyConfig(this, config['build'] || {}, this.context.configPath);
  })

  .option('-b, --base <path>',
    'Base input path for path resolving (current path by default)',
    resolveCwd
  )
  .option('-f, --file <filename>',
    'File name of file to extract, resolve from base path (index.html by default)',
    resolveCwd,
    'index.html'
  )
  .option('-o, --output <path>',
    'Path for output, resolve from file path (current folder by default)',
    resolveCwd,
    '.'
  )

  .option('-r, --reporter <reporter>', 'Reporter console (default), checkstyle',
    function(reporter){
      var reporters = ['console', 'checkstyle'];

      if (reporters.indexOf(reporter) == -1)
        throw 'Wrong value for --reporter: ' + reporter;

      return reporter;
    }
  )
  .option('--js-cut-dev', 'Remove code marked as debug from javascript source (cut off lines after ;;; and /** @cut .. */)')

  .args(function(filename){
    this.values.filename_ = resolveCwd(filename[0]);
  })

  .action(function(){
    if (this.context.configFile && this.values.verbose)
      console.log('Config: ' + this.context.configFile + '\n');

    return require('./index.js').lint.call(this, this.values);
  });

module.exports.norm = normOptions;
