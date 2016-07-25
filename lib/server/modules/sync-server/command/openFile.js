var chalk = require('chalk');
var openFile = require('../../openFile').open;
var logMsg = require('../../utils').logMsg;

module.exports = function(){
  return function(filename, callback){
    logMsg('socket', 'request ' + chalk.yellow('openFile') + ' ' + filename);

    openFile(
      filename.replace(/^\//, ''),
      callback
    );
  };
};
