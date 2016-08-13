var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var files = require('../../files');
var logMsg = require('../../utils').logMsg;
var logWarn = require('../../utils').logWarn;

function writeFile(absFilename, content, callback){
  logMsg('fs', 'Try to write file ' + absFilename, true);
  fs.writeFile(absFilename, content, function(err){
    if (err)
    {
      logWarn('socket', chalk.yellow('file:write') + ' ' + err);
      return callback(err);
    }

    files.readFileIfNeeded(absFilename, function(err, absFilename, content, digest){
      if (err)
      {
        logWarn('socket', chalk.yellow('file:write') + ' ' + err);
        return callback(err);
      }

      callback(null, {
        filename: files.relativePath(absFilename),
        digest: digest,
        content: content
      });
    });
  });
}

module.exports = function(options){
  return function(filename, content, autocreate, callback){
    logMsg('socket',
      'request ' + chalk.yellow('file:write') + ' ' + (autocreate ? '(autocreate)' : '') + filename +
      (options.verbose ? '\n' + content :  ' (' + (content || '').length + ' bytes)')
    );

    var absFilename = files.absolutePath(filename);

    if (typeof callback != 'function')
      callback = function(){};

    if (!autocreate && !fs.existsSync(absFilename))
      return callback('File doesn\'t exists');

    var dir = path.dirname(absFilename);
    if (!fs.existsSync(dir))
    {
      logMsg('fs', 'Make dir ' + dir, true);
      fs.mkdir(dir, function(err){
        if (err)
        {
          logWarn('fs', 'Write file error: ' + err);
          return callback('Write file error: ' + err);
        }

        writeFile(absFilename, content, callback);
      });
    }
    else
    {
      writeFile(absFilename, content, callback);
    }
  };
};
