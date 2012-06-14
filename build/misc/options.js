
var path = require('path');
var options = require('commander');

module.exports = function(flowData){

  options
    .option('-f, --file <filename>', 'File to build (index.html by default)', 'index.html')
    .option('-b, --base <path>', 'Base path for path resolving')
    .option('-o, --output <path>', 'Path for output', 'build')

    // general
    .option('-p, --pack', 'Pack sources. It equals to: --js-build-mode --js-cut-dev --js-pack --css-pack')
    .option('--no-single-file', 'Avoid merge sources into one file. It equals to: --js-no-single-file --css-no-single-file')

    // javascript
    .option('--js-no-single-file', 'Avoid merge javascript source into one file.')
    .option('-b, --js-build-mode', 'Evaluate modules code (close to basis.require works).')
    .option('-d, --js-cut-dev', 'Remove marked debug message from javascript source (cut from source ;;; and /** @cut .. */)')
    .option('-J, --js-pack', 'Pack javascript source.')

    // css
    .option('--css-no-single-file', 'Avoid merge CSS source into one file.')
    .option('-n, --css-optimize-names', 'Replace css class names for shorter one.')
    .option('-C, --css-pack', 'Pack CSS source.')
    .option('-i, --css-inline-image-size <n>', 'Max size for resource to be inlined (in bytes).', Number, 0)

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
        console.log(name, options[name]);
      });
  }

  // pathes

  options.base = path.resolve('.', options.base);
  var inputFilename = path.resolve(options.base, options.file);
  var inputDir = path.normalize(path.dirname(inputFilename) + '/');
  var inputBasename = path.basename(inputFilename, path.extname(inputFilename));

  options.output = path.resolve(options.base, options.output);
  var outputDir = path.normalize(options.output + '/');
  var outputFilename = path.resolve(outputDir, path.basename(inputFilename));
  var outputResourceDir = path.resolve(outputDir, 'res');

  flowData.inputFilename = inputFilename;
  flowData.inputDir = inputDir;
  flowData.inputBasename = inputBasename;

  flowData.outputFilename = outputFilename;
  flowData.outputDir = outputDir;
  flowData.outputResourceDir = outputResourceDir;

  /*console.log({
    base: options.base,
    output: options.output
  })
  console.log(flowData);
  process.exit();*/

  // return

  flowData.options = options;
};
