var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var logMsg = require('../../utils').logMsg;
var logWarn = require('../../utils').logWarn;

module.exports = function(options){
  return function(filename, content, autocreate, callback){
    logMsg('socket',
      'request ' + chalk.yellow('saveFile') + ' ' + (autocreate ? '(autocreate)' : '') + filename +
      (options.verbose ? '\n' + content :  ' (' + content.length + ' bytes)')
    );

    var fname = path.normalize(options.base + '/' + filename);

    if (typeof callback != 'function')
      callback = function(){};

    if (!autocreate)
      return callback('file doesn\'t exists');

    logMsg('fs', 'try to write file ' + fname);
    var dir = path.dirname(fname);

    if (!fs.existsSync(dir))
    {
      logMsg('fs', 'make dir ' + dir, true);
      fs.mkdir(dir, function(err){
        if (err)
        {
          logWarn('fs', 'save file error: ' + err);
          callback('Save file fault: ' + err);
        }
        else
        {
          fs.writeFile(fname, content, function(err){
            callback(err);
          });
        }
      });
    }
    else
    {
      fs.writeFile(fname, content, function(err){
        callback(err);
      });
    }
  };
};
