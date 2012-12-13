
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
exports.command = function(args, config){
  return command(args, config, build);
};

//
// if launched directly, run builder
//
if (process.mainModule === module)
  command(null, null, build);

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

  fconsole.start('Build settings');
  fconsole.log('Base:', options.base);
  fconsole.log('Input file:', options.file);
  fconsole.log('Output path:', options.output);
  fconsole.endl();

  var inputFilename = options.file;

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

    // input file graph
    options.target == 'file-map' ? require('./misc/makeFileMap') : false,
    options.target == 'input-graph' ? require('./misc/makeInputGraph') : false,

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
    require('./js/pack'),
    require('./js/realignHtml'),

    // process html
    require('./html/translate'),

    // output file graph
    options.target == 'output-graph' ? require('./misc/makeOutputGraph') : false,

    // make a zip
    options.target == 'zip' ? require('./misc/makeZip') : false,
    
    // flush output
    require('./misc/writeFiles'),

    finalHandler
  ].filter(Boolean);

  var taskCount = 0;
  var timing = [];
  var time;

  function asyncTaskStart(){
    taskCount++;
  }
  function asyncTaskDone(){
    taskCount--;
    nextHandler();
  }

  function nextHandler(){
    if (!taskCount && handlers.length)
    {
      time.time = new Date - time.time;
      timing.push(time);

      fconsole.resetDeep();

      process.nextTick(runHandler);
    }
  }

  function runHandler(){
    var handler = handlers.shift();
    var title = handler.handlerName;

    if (title)
      fconsole.log('\n' + title + '\n' + ('='.repeat(title.length)) + '\n');

    fconsole.incDeep();

    time = {
      name: title,
      time: +new Date
    };
    handler(flow, asyncTaskStart, asyncTaskDone);

    nextHandler();
  }

  runHandler();

  //
  // show totals
  //
  function finalHandler(){
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
    timing.forEach(function(t){
      var time = String(t.time || 0);
      fconsole.log(' '.repeat(6 - time.length) + time + '  ' + (t.name || '[No title step]'));
    });
    fconsole.endl();

    // total time
    fconsole.log('Build done in ' + (flow.time() / 1000).toFixed(3) + 's');
  }

  finalHandler.handlerName = 'Build stat';
}

