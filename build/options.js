
var path = require('path');
var options = require('commander');

options
  .option('-b, --base <path>', 'Base input path for path resolving (current path by default)')
  .option('-f, --file <filename>', 'File name of file to build (index.html by default)', 'index.html')
  .option('-o, --output <path>', 'Path for output', 'build.new')

  // general
  .option('-p, --pack', 'Pack sources. It equals to: --js-build-mode --js-cut-dev --js-pack --css-pack')
  .option('--no-single-file', 'Avoid merge sources into one file. It equals to: --js-no-single-file --css-no-single-file')

  // javascript
  .option('--js-no-single-file', 'Avoid merge javascript source into one file.')
  .option('--js-build-mode', 'Evaluate modules code (close to basis.require works).')
  .option('--js-cut-dev', 'Remove marked debug message from javascript source (cut from source ;;; and /** @cut .. */)')
  .option('-r, --js-resolve-path', '(experimental) Resolve local pathes to globals and replace for global references')
  .option('--js-pack', 'Pack javascript source.')

  // css
  .option('--css-no-single-file', 'Avoid merge CSS source into one file.')
  .option('--css-optimize-names', 'Replace css class names for shorter one.')
  .option('--css-pack', 'Pack CSS source.')
  .option('--css-inline-image-size <n>', 'Max size for resource to be inlined (in bytes).', Number, 0)

  //experimental
  .option('-l, --l10n-pack', 'Build l10n index, pack dictionaries and replace token names for shorter one if possible.')

  // parse argv
  .parse(process.argv);

options.jsSingleFile = options.singleFile && options.jsSingleFile;
options.cssSingleFile = options.singleFile && options.cssSingleFile;

var optionOverride = [
  {
    option: 'publish',
    override: ['pack'] //, 'archive', 'clear', 'destroy']
  },
  {
    option: 'pack',
    override: ['jsBuildMode', 'jsCutDev', 'jsPack', 'cssPack']
  }
];

for (var i = 0; i < optionOverride.length; i++)
{
  if (options[optionOverride[i].option])
    optionOverride[i].override.forEach(function(name){
      options[name] = true;
    });
}

// pathes

options.base = path.normalize(path.resolve('.', options.base) + '/');
options.output = path.normalize(path.resolve(options.base, options.output) + '/');


// TODO: remove
options.buildMode = true;

//
// Export
//

module.exports = options;
