var chalk = require('chalk');

(module.exports = function(flow){
  var fconsole = flow.console;
  var options = flow.options;
  var timing = flow.timing;

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
}).handlerName = 'Build stat';
