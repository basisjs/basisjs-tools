
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

  var handlers = [
    // extract files
    require('../extractor'),

    // input file graph
    options.target == 'file-map' ? require('./misc/makeFileMap') : false,
    options.target == 'input-graph' ? require('./misc/makeInputGraph') : false,

    // process css
    require('./css/collectNames'),
    require('./css/validateNames'),
    require('./css/optimizeNames'),
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
    require('./tmpl/pregenerate'),

    // css/html resources
    require('./res/translate'),
    require('./res/buildMap'),

    // process js
    require('./js/relink'),
    require('./js/merge'),
    require('./js/makePackages'),
    require('./js/resolvePathes'),
    require('./js/translate'),
    require('./js/json'),
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
    (function(){
      var fileTypeMap = {};
      var fileMap = {};
      var outputFileCount = 0;
      var outputSize = 0;

      flow.files.queue.forEach(function(file){
        var stat = fileTypeMap[file.type];

        if (!stat)
        {
          stat = fileTypeMap[file.type] = {
            queueFiles: [],
            outputFiles: [],
            outputSize: 0
          };
        }

        stat.queueFiles.push(file.filename);
        
        if (file.outputFilename && 'outputContent' in file)
        {
          if (!fileMap[file.outputFilename]) // prevent duplicates
          {
            fileMap[file.outputFilename] = true;
            outputFileCount++;

            var fileSize = Buffer.byteLength(file.outputContent, file.encoding);
            outputSize += fileSize;
            stat.outputSize += fileSize;
            stat.outputFiles.push(file.outputFilename + ' ' + fileSize + ' bytes');
          }
        }
      }, fileTypeMap);
                 
      fconsole.start('File queue:');
      for (var key in fileTypeMap)
        fconsole.log(key + ': ' + fileTypeMap[key].queueFiles.length);
      fconsole.endl();

      fconsole.start('Output ' + outputFileCount + ' files in ' + outputSize + ' bytes:')
      for (var key in fileTypeMap)
      {
        var files = fileTypeMap[key].outputFiles;

        if (!files.length)
          continue;

        var header = key + ': ' + files.length + ', ' + fileTypeMap[key].outputSize + ' bytes';
        if (key == 'script' || key == 'style')
        {
          fconsole.start(header);
          fconsole.list(files);
          fconsole.end();
        }
        else
          fconsole.log(header);
      }
      fconsole.endl();

    })();


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

