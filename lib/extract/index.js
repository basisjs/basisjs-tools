var fs = require('fs');
var path = require('path');
var Flow = require('../build/misc/flow');
var command = require('./command');
var isChildProcess = typeof process.send == 'function'; // child process has send method
var Promise = require('es6-promise-polyfill').Promise;

require('../build/misc/utils'); // TODO: make it explicit

if (isChildProcess)
  process.on('uncaughtException', function(err){
    process.send({
      error: 'Exception: ' + err
    });
    process.exit(8);
  });


//
// export
//
//exports.handler = extractHandler;
exports.handlers = extractHandlers;


//
// launched by another module
//
exports.extract = function(config){
  if (this === command)
    return extract(config);

  if (this === exports)
    return extract(command.normalize(config));
};

//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
// main function
//
function extract(config){
  //
  // init
  //

  var options = command.norm(config);
  var inputFilename = options.file;
  var flow = new Flow(options);
  var fconsole = flow.console;
  var noOutput = isChildProcess || !options.writeFile;

  if (noOutput || options.silent)
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

  // check input file exists
  if (!fs.existsSync(inputFilename) || !fs.statSync(inputFilename).isFile())
  {
    console.warn('Input file ' + inputFilename + ' not found');
    return;
  }

  fconsole.start('\nInit\n====\n');

  // add input file in queue
  flow.indexFile = flow.files.add({
    filename: path.basename(inputFilename)
  });


  //
  // Main part
  //

  var handlers = extractHandlers(flow.options).concat([
    require('./misc/stat'),

    // target
    {
      'file-map': require('./target/fileMap'),
      'input-graph': require('./target/inputGraph'),
    }[flow.options.target],

    // save result
    !noOutput && options.target != 'none' ? require('../build/misc/writeFiles.js') : null,

    require('./misc/summary')
  ]).filter(Boolean);

  var taskCount = 0;
  var timing = flow.timing = [];
  var time;
  var resolve = function(){};
  var reject = function(){};
  var result = new Promise(function(resolve_, reject_){
    resolve = resolve_;
    reject = reject_;
  });

  function asyncTaskStart(){
    taskCount++;
  }
  function asyncTaskDone(){
    taskCount--;
    nextHandler();
  }

  function nextHandler(){
    if (!taskCount)
    {
      if (handlers.length)
      {
        var timeDiff = process.hrtime(time.time);
        time.time = parseInt(timeDiff[0] * 1e3 + timeDiff[1] / 1e6, 10);
        timing.push(time);
      }

      process.nextTick(runHandler);
    }
  }

  function runHandler(){
    if (!handlers.length)
      return resolve(flow);

    var handler = handlers.shift();
    var title = handler.handlerName || 'Untitled handler';
    var skipped = typeof handler.skip == 'function' ? handler.skip(flow) : false;

    fconsole.resetDeep();

    if (title)
      fconsole.log('\n' + title + '\n' + ('='.repeat(title.length)) + '\n');

    fconsole.incDeep();

    if (skipped)
    {
      fconsole.log('Skipped.');
      fconsole.log(skipped);
      process.nextTick(runHandler);
    }
    else
    {
      time = {
        name: title,
        time: process.hrtime()
      };

      handler(flow, asyncTaskStart, asyncTaskDone);
      nextHandler();
    }
  }

  process.nextTick(runHandler);

  if (isChildProcess)
  {
    result.then(function(flow){
      var res = flow.files.queue[0];
      if (res && res.outputFilename == 'file-map.json')
      {
        process.send({
          data: res.outputContent
        });
      }
      else
      {
        process.send({
          error: 'Error on file map fetch'
        });
      }
      process.exit();
    });
  }
  else
    return result;
}

function extractHandlers(options){
  return [
    require('./html'),
    require('./js'),
    require('./tmpl'),
    require('./css'),
    require('./res'),
    require('./l10n'),

    //options && options.l10nInfo ? require('./l10n/collectInfo') : null,
    require('./l10n/collectInfo'), // FIXME: should be optional
    options && options.cssInfo ? require('./css/collectInfo') : null
  ].filter(Boolean);
}

// function extractHandler(flow){
//   extractHandlers().forEach(function(handler){
//     handler(flow);
//   });
// }
// extractHandler.handlerName = 'Extract file graph';
