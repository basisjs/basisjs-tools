
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

var targets = ['zip', 'output-graph', 'fs']; // last is default
var handlers = {
  pack: function(){
    this.jsBuildMode = true;
    this.jsCutDev = true;
    this.jsPack = true;
    this.cssPack = true;
  },
  singleFile: function(){
    this.jsSingleFile = false;
    this.cssSingleFile = false;
  },
  target: function(target){
    target = String(target).toLowerCase();

    if (targets.indexOf(target) == -1)
      return 'fs';

    return target;
  }
}

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
  return command
    .description('Make a file build')

    .option('-b, --base <path>', 'Base input path for path resolving (current path by default)', path.resolve)
    .option('-f, --file <filename>', 'File name of file to build, resolve from base path (index.html by default)', function(filename){
      command.base = null;
      return path.resolve(filename);
    }, 'index.html')
    .option('-o, --output <path>', 'Path for output, resolve from file path (build by default)', path.resolve, 'build')

    .option('-t, --target <target>', 'Define what build should produce. Target could be: ' + targets.join(', ') + ' (file system by default).', handlers.target, targets[targets.length - 1])

    // bulk flags
    .option('-p, --pack', 'Pack sources. It equals to: --js-build-mode --js-cut-dev --js-pack --css-pack')
    .on('pack', handlers.pack)
    .option('--no-single-file', 'Avoid merge sources into one file. It equals to: --js-no-single-file --css-no-single-file')
    .on('single-file', handlers.singleFile)

    // javascript
    .option('--js-no-single-file', 'Avoid merge javascript source into one file.')
    .option('--js-build-mode', 'Evaluate modules code (close to how basis.require works).')
    .option('--js-cut-dev', 'Remove code marked as debug from javascript source (cut off lines after ;;; and /** @cut .. */)')
    .option('-r, --js-resolve-path', '(experimental) Resolve local pathes to globals and replace for global references')
    .option('--js-pack', 'Pack javascript source.')
    .option('--js-pack-cmd <string>', 'Command to launch javascript packer, should accept input in stdio and output result in stdout (`google-closure-compiler --charset UTF-8` by default).')

    // css
    .option('--css-no-single-file', 'Avoid merge CSS source into one file.')
    .option('--css-optimize-names', '(experimental) Replace css class names for shorter one.')
    .option('--css-cut-unused', '(experimental) Cut unused selectors and rules')
    .option('--css-pack', 'Pack CSS source.')
    //.option('-i, --css-inline-image-size <max-size>', '(reserved, but not work for now) Max size for resource to be inlined (in bytes). Default is 0, don\'t inline images.', Number, 0)

    // l10n
    .option('-l, --l10n-pack', 'Build l10n index, pack dictionaries and replace token names for shorter one if possible.')

    // tmpl
    .option('--tmpl-pregenerate', 'Pregenerate template functions to avoid building template functions in runtime.')

    //.on('target', handlers.target)

    .on('*', function(args){
      //console.log('[DEBUG] star rule:', args);
      this.file = path.resolve(args[0]);
      this.base = null;
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

  /*if (options.jsCutDev)
  {
    if (!options.preprocess['script'])
      options.preprocess['script'] = [];
    options.preprocess['script'].push('./misc/preprocess/js-cut-dev.js');
  }*/

  return options;
}

