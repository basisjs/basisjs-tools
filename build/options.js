
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

function command(args, config, action){
  var command = apply(commander.command('build'), args);

  if (config)
  {
    config.base = path.resolve(config._configPath, config.base);
    for (var key in config)
    {
      if (hasOption(command, key))
      {
        if ((key == 'file' || key == 'output') && config._configPath)
          config[key] = path.resolve(config._configPath, config[key]);

        command[key] = config[key];
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
    .option('-f, --file <filename>', 'File name of file to build, resolve from base path (index.html by default)', path.resolve, 'index.html')
    .option('-o, --output <path>', 'Path for output, resolve from file path (build by default)', path.resolve, 'build')

    // bulk flags
    .option('-p, --pack', 'Pack sources. It equals to: --js-build-mode --js-cut-dev --js-pack --css-pack')
    .on('pack', function(){
      this.jsBuildMode = true;
      this.jsCutDev = true;
      this.jsPack = true;
      this.cssPack = true;
    })
    .option('--no-single-file', 'Avoid merge sources into one file. It equals to: --js-no-single-file --css-no-single-file')
    .on('single-file', function(){
      this.jsSingleFile = false;
      this.cssSingleFile = false;
    })

    // javascript
    .option('--js-no-single-file', 'Avoid merge javascript source into one file.')
    .option('--js-build-mode', 'Evaluate modules code (close to how basis.require works).')
    .option('--js-cut-dev', 'Remove code marked as debug from javascript source (cut lines after ;;; and /** @cut .. */)')
    .option('-r, --js-resolve-path', '(experimental) Resolve local pathes to globals and replace for global references')
    .option('--js-pack', 'Pack javascript source.')

    // css
    .option('--css-no-single-file', 'Avoid merge CSS source into one file.')
    .option('--css-optimize-names', 'Replace css class names for shorter one.')
    .option('--css-pack', 'Pack CSS source.')
    .option('--css-inline-image-size <n>', 'Max size for resource to be inlined (in bytes).', Number, 0)

    //experimental
    .option('-l, --l10n-pack', 'Build l10n index, pack dictionaries and replace token names for shorter one if possible.');
}

function norm(options){
  // pathes

  options.base = path.normalize(path.resolve(options.base) + '/'); // [base]
  options.file = path.normalize(path.resolve(options.file));
  options.output = path.normalize(path.resolve(options.output) + '/');


  // TODO: remove
  options.buildMode = true;

  return options;
}

