var fs = require('fs');
var path = require('path');
var Flow = require('../build/misc/flow');
var extract = require('../extract');
var command = require('./command');
var chalk = require('chalk');
var readline = require('readline');
var utils = require('../build/misc/utils'); // TODO: make it explicit

//
// launched by another module
//
exports.lint = function(config){
  if (this === command)
    lint(config);

  if (this === exports)
    lint(command.normalize(config));
};

//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
// main function
//
function lint(config){

  //
  // init
  //

  var options = command.norm(config);
  var inputFilename = options.file;
  var flow = new Flow(options);
  var fconsole = flow.console;

  fconsole.enabled = options.verbose;
  chalk.enabled = options.color && process.stdout.isTTY;


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
        {
          console.warn('[ERROR] Preprocessor has no process function. Skipped.');
          process.exit();
        }
      } catch(e) {
        console.warn('[ERROR] Error on preprocessor load: ' + e);
        process.exit();
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

  // check input file exists
  if (!fs.existsSync(inputFilename) || !fs.statSync(inputFilename).isFile())
  {
    console.warn('Input file ' + inputFilename + ' not found');
    process.exit();
  }

  // add input file in queue
  flow.indexFile = flow.files.add({
    isIndexFile: true,
    filename: path.basename(inputFilename)
  });


  //
  // Main part
  //

  var handlers = extract.handlers({
    cssInfo: true,
    l10nInfo: true
  }).concat([
    function(flow){
      var fconsole = flow.console;
      fconsole.enabled = true;

      switch (flow.options.reporter)
      {
        case 'checkstyle':
          require('./reporter/checkstyle.js')(flow);
          break;
        default:
          require('./reporter/default.js')(flow);
      }
    }
  ]);

  var taskCount = 0;

  function asyncTaskStart(){
    taskCount++;
  }
  function asyncTaskDone(){
    taskCount--;
    nextHandler();
  }

  function nextHandler(){
    var lastHandler = !handlers.length;

    if (!taskCount && !lastHandler)
      process.nextTick(runHandler);
  }

  function runHandler(){
    var handler = handlers.shift();
    var skipped = typeof handler.skip == 'function' ? handler.skip(flow) : false;

    if (skipped)
      return process.nextTick(runHandler);

    fconsole.resetDeep();
    handler(flow, asyncTaskStart, asyncTaskDone);
    nextHandler();
  }

  runHandler();
}
