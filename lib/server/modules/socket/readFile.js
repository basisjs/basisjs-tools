var path = require('path');
var chalk = require('chalk');
var files = require('../files');
var logMsg = require('../utils').logMsg;
var relPathBuilder = require('../utils').relPathBuilder;

module.exports = function(options){
  var normPath = relPathBuilder(options.base);

  return function(filename, callback){
    logMsg('socket', 'request ' + chalk.yellow('readFile') + ' /' + filename);

    files.readFile(path.normalize(options.base + '/' + filename), function(err, data, filename){
      if (err)
        callback(err);
      else
        callback(null, {
          filename: normPath(filename),
          content: data
        });
    });
  };
};
