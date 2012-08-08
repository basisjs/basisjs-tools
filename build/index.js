
var fs = require('fs');
var path = require('path');
var Flow = require('./misc/flow');

var moduleOptions = require('./options');
var command = moduleOptions.command;

require('./misc/utils'); // TODO: make it explicit

//
// export
//

exports.build = build;
exports.options = moduleOptions;
exports.command = function(commander, args){
  return command(commander, args, build);
};

//
// if launched directly, run builder
//
if (process.mainModule === module)
  command(null, true, build);

//
// main function
//

function build(options){

  //
  // init
  //

  options = moduleOptions.norm(options);

  var flow = new Flow(options);
  var fconsole = flow.console;

  flow.outputResourceDir = 'res/';

  var inputFilename = path.resolve(options.base, options.file);

  // check input file exists
  if (!fs.existsSync(inputFilename) || !fs.statSync(inputFilename).isFile())
  {
    console.warn('Input file ' + inputFilename + ' not found');
    process.exit();
  }

  // add input file in queue
  flow.files.add({
    filename: inputFilename
  });


  //
  // Main part
  //

  var handlers = [
    // extract files
    require('./html/extract'),
    require('./js/extract'),

    //require('./js/ast_tools/translator_test'),

    require('./tmpl/extract'),
    require('./css/extract'),
    require('./res/extract'),
    require('./l10n/extract'),

    // process css
    require('./css/makePackages'),
    require('./css/linear'),
    require('./css/merge'),
    require('./css/pack'),
    require('./css/translate'),

    // process l10n
    require('./l10n/buildIndex'),
    require('./l10n/makePackages'),
    require('./l10n/pack'),
    require('./l10n/modifyCall'),

    // process tmpl
    require('./tmpl/translate'),

    // css/html resources
    require('./res/translate'),
    require('./res/buildMap'),

    // process js
    require('./js/relink'),
    require('./js/merge'),
    require('./js/makePackages'),
    require('./js/resolvePathes'),
    require('./js/translate'),
    require('./js/buildPackages'),
    require('./js/realignHtml'),

    // process html
    require('./html/translate'),
    
    // flush output
    require('./misc/writeFiles')
  ];

  handlers.forEach(function(handler){
    var title = handler.handlerName;

    if (title)
      fconsole.log('\n' + title + '\n' + ('='.repeat(title.length)) + '\n');

    fconsole.incDeep();

    var handlerTime = new Date();
    handler(flow);

    // save handler time
    handler.time = (new Date - handlerTime);

    fconsole.resetDeep();

    fconsole.log('');
    fconsole.log('Time: ' + (handler.time / 1000).toFixed(3) + 's');
  });

  //
  // show totals
  //

  fconsole.start('\nBuild stat\n==========\n');

  // file types
  fconsole.start('File stat:');
  (function(){
    var fileTypeMap = {};
    flow.files.queue.forEach(function(file){
      if (!this[file.type])
        this[file.type] = [];

      this[file.type].push(file.filename);
    }, fileTypeMap);
               
    for (var key in fileTypeMap)
      fconsole.log(key + ': ' + fileTypeMap[key].length);
  })();

  fconsole.endl();

  // timing
  fconsole.start('Timing:');
  handlers.forEach(function(handler){
    var time = String(handler.time);
    fconsole.log(' '.repeat(5 - time.length) + time + '  ' + (handler.handlerName || '[No title step]'));
  });
  fconsole.endl();

  // total time
  fconsole.log('Build done in ' + (flow.time() / 1000).toFixed(3) + 's');
}

