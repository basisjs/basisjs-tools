var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var logMsg = require('../../utils').logMsg;

module.exports = function(options, broadcast){
  return function(filename, content, callback){
    logMsg('socket',
      'request ' + chalk.yellow('createFile') + ' ' + filename +
      (options.verbose ? '\n' + content : ' (' + (content || '').length + ' bytes)')
    );

    var fname = options.base + '/' + filename;
    content = content || '';

    if (typeof callback != 'function')
      callback = function(){};

    if (fs.existsSync(fname) || !fs.existsSync(path.dirname(fname)))
      callback('bad filename');
    else
      fs.writeFile(fname, content, function(err){
        if (err)
          return callback(err);

        broadcast('newFile', {
          filename: filename,
          content: content
        });
      });
  };
};
