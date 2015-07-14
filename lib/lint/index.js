var fs = require('fs');
var path = require('path');
var Flow = require('../common/flow');
var extract = require('../extract');
var command = require('./command');
var chalk = require('chalk');
var readline = require('readline');
var utils = require('../common/utils'); // TODO: make it explicit
var exit = require('exit');

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
          console.error('[ERROR] Preprocessor has no process function. Skipped.');
          exit(2);
        }
      } catch(e) {
        console.error('[ERROR] Error on preprocessor load: ' + e);
        exit(2);
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
    console.error('Input file ' + inputFilename + ' not found');
    exit(2);
  }

  // add input file in queue
  flow.indexFile = flow.files.add({
    isIndexFile: true,
    filename: path.basename(inputFilename)
  });


  //
  // Main part
  //

  var reporters = {
    checkstyle: './reporter/checkstyle.js',
    junit: './reporter/junit.js',
    default: './reporter/default.js'
  };

  var handlers = extract.handlers({
    jsInfo: true,
    cssInfo: true,
    l10nInfo: true
  }).concat([
    function(flow){
      var fconsole = flow.console;
      fconsole.enabled = true;

      require(reporters[flow.options.reporter] || reporters.default)(flow);
    },
    function(flow){
      // if has warnings exit with code 2 as error
      if (flow.warns.length)
        exit(2);
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
