var chalk = require('chalk');
var files = require('../../files');
var logMsg = require('../../utils').logMsg;

module.exports = function(){
  return function(filename, callback){
    logMsg('socket', 'request ' + chalk.yellow('file:read') + ' ' + filename);

    files.readFileIfNeeded(files.absolutePath(filename), function(err, absFilename, content, digest){
      if (err)
        callback(err);
      else
        callback(null, {
          filename: filename,
          digest: digest,
          content: content
        });
    });
  };
};
