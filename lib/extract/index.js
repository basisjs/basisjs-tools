var fs = require('fs');
var path = require('path');
var Flow = require('../build/misc/flow');
var command = require('./command');
var isChildProcess = typeof process.send == 'function'; // child process has send method

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
exports.handler = extractHandler;
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
  var flow = new Flow(
    options.base,
    path.dirname(path.relative(options.base, inputFilename)),
    options
  );
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

  var finalHandler = function(){
    // warnings
    if (flow.warns.length)
    {
      fconsole.start('Warnings (' + flow.warns.length + '):');

      var warnByFilename = {};
      flow.warns.forEach(function(warn){
        var filename = warn.file
          ? warn.file //path.relative(options.base, path.resolve(options.base, warn.file)).replace(/\\/g, '/')
          : '[nofilename]';

        if (!warnByFilename[filename])
          warnByFilename[filename] = [];
        warnByFilename[filename].push(warn.message);
      });

      Object.keys(warnByFilename).sort().forEach(function(key){
        fconsole.start(key);
        fconsole.list(warnByFilename[key]);
        fconsole.endl();
      });

      fconsole.endl();
    }
    else
      fconsole.log('No warnings\n');

    // timing
    fconsole.start('Timing:');
    timing.forEach(function(t){
      var time = String(t.time || 0);
      fconsole.log(' '.repeat(6 - time.length) + time + '  ' + (t.name || '[No title step]'));
    });
    fconsole.endl();

    // total time
    fconsole.log('Extract done in ' + (flow.time() / 1000).toFixed(3) + 's');
  };
  finalHandler.handlerName = 'Extract stat';

  var handlers = extractHandlers(flow.options).concat([
    statHandler,

    // target
    {
      'file-map': require('./target/fileMap'),
      'input-graph': require('./target/inputGraph'),
    }[flow.options.target],

    // save result
    !noOutput && options.target != 'none' ? require('../build/misc/writeFiles.js') : null,

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

      runHandler();
    }
  }

  function runHandler(){
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
      runHandler();
    }
    else
    {
      time = {
        name: title,
        time: Number(new Date)
      };

      handler(flow, asyncTaskStart, asyncTaskDone);
      nextHandler();
    }
  }

  runHandler();

  if (isChildProcess)
  {
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
  }
  else
    return flow;
}

function extractHandlers(options){
  return [
    require('./html'),
    require('./js'),
    require('./tmpl'),
    require('./css'),
    require('./res'),
    require('./l10n'),
    require('./l10n/collectInfo'),

    options && options.cssInfo ? require('./css/collectInfo') : null
  ].filter(Boolean);
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
