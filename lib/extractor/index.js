var fs = require('fs');
var path = require('path');
var Flow = require('../build/misc/flow');

var moduleOptions = require('./options');
var command = moduleOptions.command;

require('../build/misc/utils'); // TODO: make it explicit

//
// export
//

exports.extract = extract;
exports.handler = extractHandler;
exports.handlers = extractHandlers;
exports.options = moduleOptions;
exports.command = function(args, config){
  return command(args, config, extract);
};

//
// if launched directly, run builder
//
if (process.mainModule === module)
  command(null, null, extract);

//
// main function
//

function extract(options){

  //
  // init
  //

  options = moduleOptions.norm(options);

  var flow = new Flow(options);
  var fconsole = flow.console;

  if (!options.writeFile)
    fconsole.log = function(){};

  fconsole.start('Extract settings');
  fconsole.log('Base:', options.base);
  fconsole.log('Input file:', options.file);
  fconsole.log('Output path:', options.output);
  fconsole.endl();


  //
  // preprocessing
  //

  fconsole.start('Preprocessors');
  for (var type in options.preprocess)
  {
    var list = options.preprocess[type];
    var newList = flow.files.preprocess[type] = [];
    var hasPrerocessor = false;

    for (var i = 0; i < list.length; i++)
    {
      var preprocessorPath = list[i];

      fconsole.log('[' + type + '] ' + preprocessorPath);

      try {
        var processor = require(preprocessorPath);

        if (typeof processor.process == 'function')
        {
          newList.push(processor.process);
          hasPrerocessor = true;
        }
        else
          fconsole.log('[ERROR] Preprocessor has no process function. Skipped.');
      } catch(e) {
        fconsole.log('[ERROR] Error on preprocessor load: ' + e);
      }

      fconsole.end();
    }
  }
  if (!hasPrerocessor)
    fconsole.log('  not defined');
  fconsole.endl();


  //
  // process input
  //
  var inputFilename = options.file;

  // check input file exists
  if (!fs.existsSync(inputFilename) || !fs.statSync(inputFilename).isFile())
  {
    console.warn('Input file ' + inputFilename + ' not found');
    process.exit();
  }

  fconsole.start('\nInit\n====\n');

  // add input file in queue
  flow.files.add({
    filename: inputFilename
  });


  //
  // Main part
  //

  var handlers = extractHandlers().concat([
    statHandler,

    // target
    {
      'file-map': require('./target/fileMap'),
      'input-graph': require('./target/inputGraph'),
    }[flow.options.target],

    // save result
    flow.options.writeFile ? require('../build/misc/writeFiles.js') : null,

    finalHandler
  ]).filter(Boolean);

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

      runHandler();
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
    // timing
    fconsole.start('Timing:');
    timing.forEach(function(t){
      var time = String(t.time || 0);
      fconsole.log(' '.repeat(6 - time.length) + time + '  ' + (t.name || '[No title step]'));
    });
    fconsole.endl();

    // total time
    fconsole.log('Extract done in ' + (flow.time() / 1000).toFixed(3) + 's');
  }

  finalHandler.handlerName = 'Extract stat';

  return flow;
}

function extractHandlers(){
  return [
    require('./html'),
    require('./js'),
    require('./tmpl'),
    require('./css'),
    require('./res'),
    require('./l10n')
  ];
}

function extractHandler(flow){
  extractHandlers().forEach(function(handler){
    handler(flow);
  });
}
extractHandler.handlerName = 'Extract file graph';


// file types
function statHandler(flow){
  var fileTypeMap = {};
  var fconsole = flow.console;

  flow.files.queue.forEach(function(file){
    fileTypeMap[file.type] = (fileTypeMap[file.type] || 0) + 1;
  }, fileTypeMap);
             
  fconsole.start('File queue:');
  for (var key in fileTypeMap)
    fconsole.log(key + ': ' + fileTypeMap[key]);
  fconsole.endl();
}
statHandler.handlerName = 'File statistic';
