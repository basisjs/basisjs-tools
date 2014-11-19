var fs = require('fs');
var path = require('path');
var Flow = require('./misc/flow');
var extract = require('../extract');
var command = require('./command');
var chalk = require('chalk');
var readline = require('readline');
var utils = require('./misc/utils'); // TODO: make it explicit

//
// launched by another module
//
exports.build = function(config){
  if (this === command)
    build(config);

  if (this === exports)
    build(command.normalize(config));
};

//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
function getToolsId(){
  var toolsPkg = require('../../package.json');
  var toolsId = toolsPkg._id;
  var commit;

  if (!toolsId)
  {
    commit = utils.fetchCommit(__dirname + '/../..');
    toolsId = toolsPkg.name + '@' + toolsPkg.version;
  }
  else
  {
    if (toolsPkg._resolved)
    {
      var m = toolsPkg._resolved.match(/#(.{1,10})/);
      if (m)
        commit = m[1];
    }
  }

  return toolsId + (commit ? ' (' + commit + ')' : '');
}

//
// main function
//
function build(config){

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

  flow.exitOnFatal = true;
  flow.outputResourceDir = 'res/';

  fconsole.enabled = options.verbose;
  chalk.enabled = options.color && process.stdout.isTTY;

  if (options.verbose)
  {
    // TODO: add more settings output
    fconsole.start('Build info (' + getToolsId() + ')');
    fconsole.log('Base:', options.base);
    fconsole.log('Index file:', options.file);
    fconsole.log('Output:', options.output);
    fconsole.endl();
  }
  else
  {
    var cwd = process.env.PWD || process.cwd();

    process.stdout.write(
      'Build with ' + chalk.green(getToolsId()) + '\n' +
      'Base path: ' +
        options.base + '\n' +
      'Index file: ' +
        chalk.green(path.relative(cwd, options.file).replace(/^([^\.\/])/, './$1').replace(/\\/g, '/')) + '\n' +
      'Output: ' +
        chalk.green(path.relative(cwd, options.output).replace(/^([^\.\/])/, './$1').replace(/\\/g, '/') || '<current folder>') + '\n' +
      '\n'
    );
  }

  flow.files.typeByExt = options.extFileTypes;


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

  fconsole.start('\nInit\n====\n');

  // add input file in queue
  flow.indexFile = flow.files.add({
    isIndexFile: true,
    filename: path.relative(options.base, inputFilename)
  });


  //
  // Main part
  //

  var handlers = extract.handlers({
    cssInfo: flow.options.cssOptimizeNames || flow.options.cssCutUnused,
    l10nInfo: true
  }).concat([
    // convert resources to base64 if it make sense
    require('./res/base64'),

    // process css
    require('./css/cutUnused'),
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

    // process tmpl
    require('./tmpl/translate'),
    require('./tmpl/pregenerate'),

    // css/html resources
    require('./res/translate'),
    require('./res/buildMap'),

    // process js
    require('./js/relink'),
    //require('./js/merge'),
    require('./js/makePackages'),
    require('./js/resolvePathes'),
    require('./js/translate'),
    require('./js/json'),
    require('./js/buildPackages'),
    require('./js/pack'),
    require('./js/realignHtml'),

    // process html
    require('./html/translate'),

    // target transformation
    {
      'output-graph': require('./target/outputGraph'),
      'zip': require('./target/zip')
    }[options.target],

    // flush output
    require('./misc/writeFiles'),

    finalHandler
  ]).filter(Boolean);

  var taskCount = 0;
  var timing = [];
  var time;
  var stdoutPos;

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

      if (!options.verbose)
      {
        var extraInfo = typeof time.handler.extraInfo == 'function'
          ? time.handler.extraInfo(flow)
          : '';
        if (process.stdout.isTTY)
        {

          if (process.stdout._bytesDispatched == stdoutPos)
          {
            readline.moveCursor(process.stdout, 0, -1);
            readline.clearLine(process.stdout, 0);
            process.stdout.write(
              stdoutHandlerTitle +
              (extraInfo ? chalk.gray(' [') + chalk.yellow(extraInfo) + chalk.gray(']') : '') +
              chalk.gray(' – '));
          }
          else
          {
            if (extraInfo)
              process.stdout.write('       ' + chalk.yellow(extraInfo) + '\n');

            process.stdout.write('       ');
          }

          process.stdout.write(
            chalk.green('DONE') +
            (time.time > 10 ? chalk.gray(' (' + time.time + 'ms)') : '') +
            '\n'
          );
        }
        else
        {
          if (extraInfo)
            process.stdout.write('       * ' + extraInfo + '\n');
        }
      }

      fconsole.resetDeep();

      process.nextTick(runHandler);
    }
  }

  function runHandler(){
    var handler = handlers.shift();
    var title = handler.handlerName || 'Untitled handler';

    if (options.verbose)
      fconsole.log('\n' + title + '\n' + ('='.repeat(title.length)) + '\n');
    else
    {
      if (handler != finalHandler)
      {
        stdoutHandlerTitle = title.replace(/^(?:\[(\S+)\] ?|)/, function(m, topic){
          return '     '.substr((topic || '').length) + chalk.cyan(topic || '') + '  ';
        });
        process.stdout.write(stdoutHandlerTitle + '\n');
        stdoutPos = process.stdout._bytesDispatched;
      }
    }

    fconsole.incDeep();

    time = {
      handler: handler,
      name: title,
      time: Number(new Date)
    };
    handler(flow, asyncTaskStart, asyncTaskDone);

    nextHandler();
  }

  runHandler();

  //
  // show summary
  //
  function finalHandler(){
    if (!options.verbose)
    {
      fconsole.resetDeep();
      fconsole.enabled = true;
      process.stdout.write('\n');
    }

    if (options.verbose)
    {
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

        fconsole.start('Output ' + outputFileCount + ' files in ' + outputSize + ' bytes:');
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
    }

    // total time
    fconsole.log('Warnings: ' + (flow.warns.length ? chalk.bgRed(flow.warns.length) : chalk.green('NO')));
    if (options.warnings)
    {
      (function(){
        var warns = {};

        flow.warns.forEach(function(item){
          var filename = item.file || '[no file]';
          if (!warns[filename])
            warns[filename] = [];
          warns[filename].push(item.message);
        });

        fconsole.incDeep();
        for (var filename in warns)
        {
          fconsole.start(filename);
          fconsole.list(warns[filename]);
          fconsole.endl();
        }
        fconsole.end();
      })();
    }

    fconsole.log('Build done in ' + chalk.yellow((flow.time() / 1000).toFixed(3) + 's') + '\n');
  }

  finalHandler.handlerName = 'Build stat';
}
