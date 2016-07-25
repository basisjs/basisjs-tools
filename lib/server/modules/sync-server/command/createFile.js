var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var logMsg = require('../../utils').logMsg;
var files = require('../../files');

module.exports = function(options, broadcast){
  return function(filename, content, callback){
    logMsg('socket',
      'request ' + chalk.yellow('createFile') + ' ' + filename +
      (options.verbose ? '\n' + content : ' (' + (content || '').length + ' bytes)')
    );

    var fname = files.absolutePath(filename);
    content = content || '';

    if (typeof callback != 'function')
      callback = function(){};

    if (fs.existsSync(fname) || !fs.existsSync(path.dirname(fname)))
      callback('bad filename');
    else
      fs.writeFile(fname, content, function(err){
        if (err)
          return callback(err);

        files.readFile(filename, function(err, filename, content, digest){
          broadcast('newFile', {
            filename: filename,
            digest: digest,
            content: content
          });
        });
      });
  };
};
