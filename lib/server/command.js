var path = require('path');
var clap = require('clap');


function applyConfig(command, config){
  if (config._configPath)
    config.base = path.resolve(config._configPath, config.base || '');

  for (var name in config)
    if (command.hasOption(name))
      command.setOption(name, config[name]);

  ['ignore', 'rewrite', 'handler', 'preprocess'].forEach(function(name){
    if (config[name])
      command.values[name] = config[name];
  });

  return command;
}

function normOptions(options){
  options.base = path.normalize(path.resolve(options.base || '') + '/'); // [base]

  if (!options.cache)
  {
    options.readCache = false;
    options.resCache = false;
  }

  if (options.index)
    options.index = path.normalize(path.resolve(options.base, options.index) + '/');

  options.ignore = !Array.isArray(options.ignore) ? [] : options.ignore.map(function(p){
    return path.resolve(options.base, p);
  });

  if (!Array.isArray(options.handler))
  {
    if (typeof options.handler == 'string')
      options.handler = [options.handler];
    else
      options.handler = null;
  }

  if (options.handler)
  {
    options.handler = options.handler.map(function(fn){
      return path.normalize(path.resolve(fn));
    });
  }

  var preprocess = options.preprocess;
  options.preprocess = {};

  for (var key in preprocess)
  {
    var handlerList = preprocess[key];

    if (!Array.isArray(handlerList))
    {
      if (typeof handlerList == 'string')
        handlerList = [handlerList];
      else
        handlerList = [];
    }

    options.preprocess[key] = handlerList.map(function(fn){
      return path.normalize(path.resolve(module.exports._configPath || '.', fn));
    });
  }

  return options;
}

module.exports = clap.create('server')
  .description('Launch dev-server')

  .init(function(){
    if (this.config)
    {
      var data = this.config[this.name] || {};
      data._configPath = this.configPath;
      applyConfig(this, data);
    }
  })

  .option('-b, --base <path>', 'base path for path resolving (current path by default)')
  .option('-p, --port <n>', 'listening port (default 8000)', function(value){ return isNaN(value) ? 0 : Number(value); }, 8000)
  .option('-n, --no-sync', 'don\'t listen fs changes')
  .option('--run-acp-server', 'start server to launch ACP as standalone app')
  .option('-i, --index <relpath>', 'build index file on start which contains all .js, .css and .json files for path (relative to base)')
  .option('--no-cache', 'don\'t use any cache')
  .option('--no-res-cache', 'don\'t use resource map for hot start')
  .option('--no-read-cache', 'don\'t use read file content')
  .option('--hot-start-cache-by-ext', 'put file into hot start cache depends on file ext (by default put file to cache if request has x-basis-resource header)')
  .option('--no-dot-filename-ignore', 'don\'t ignore filenames starting with dot')
  .option('--verbose', 'verbose log message output')
  .option('--no-color', 'suppress color output')
  .option('-e, --editor <command>', 'specify command on openFile request')

  .action(function(){
    if (this.values.verbose && this.configFile)
      console.log('Use config: ' + this.configFile + '\n');

    require('./index.js').launch.call(this, this.values);
  });

module.exports.norm = normOptions;
