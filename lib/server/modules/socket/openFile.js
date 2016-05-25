var child_process = require('child_process');
var path = require('path');
var chalk = require('chalk');
var utils = require('../utils');
var logMsg = utils.logMsg;
var logWarn = utils.logWarn;

module.exports = function(options){
  return function(filename, callback){
    logMsg('socket', 'request ' + chalk.yellow('openFile') + ' ' + filename);

    if (typeof callback != 'function')
      callback = function(){};

    if (options.editor)
    {
      var cmd = options.editor + ' ' + path.resolve(options.base, filename.replace(/^\//, ''));

      logMsg('cmd', cmd, true);
      child_process.exec(cmd, function(err){
        if (err)
        {
          callback('Run command error: ' + err);
          logWarn('cli', 'openFile: ' + String(err).replace(/[\r\n]+$/, ''));
        }
        else
          callback();
      });
    }
    else
    {
      logWarn('cli', 'Editor command is no specified, request ignored');
      callback('Editor command is no specified, request ignored');
    }
  };
};
