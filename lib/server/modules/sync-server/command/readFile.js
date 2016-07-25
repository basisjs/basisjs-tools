var path = require('path');
var chalk = require('chalk');
var files = require('../../files');
var logMsg = require('../../utils').logMsg;
var relPathBuilder = require('../../utils').relPathBuilder;

module.exports = function(options){
  var normPath = relPathBuilder(options.base);

  return function(filename, callback){
    logMsg('socket', 'request ' + chalk.yellow('readFile') + ' /' + filename);

    files.readFileIfNeeded(path.normalize(path.join(options.base, filename)), function(err, data, filename, content, digest){
      if (err)
        callback(err);
      else
        callback(null, {
          filename: normPath(filename),
          digest: digest,
          content: data
        });
    });
  };
};
