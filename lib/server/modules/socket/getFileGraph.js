var path = require('path');
var url = require('url');
var fs = require('fs');
var chalk = require('chalk');
var utils = require('../utils');
var logMsg = utils.logMsg;
var logWarn = utils.logWarn;

function resolveFilename(filename){
  if (!fs.existsSync(filename))
    return false;

  if (fs.statSync(filename).isDirectory())
  {
    if (fs.existsSync(filename + path.sep + 'index.html'))
      return path.normalize(filename + path.sep + 'index.html');

    if (fs.existsSync(filename + path.sep + 'index.htm'))
      return path.normalize(filename + path.sep + 'index.htm');

    return false;
  }

  return filename;
}

module.exports = function(options){
  return function(filename, callback){
    logMsg('socket', 'request ' + chalk.yellow('getFileGraph') + ' ' + filename);

    if (typeof callback == 'function')
    {
      var fn = resolveFilename(path.normalize(options.base + url.parse(filename, false, true).pathname));
      var startTime = new Date;
      var args = [
        '--file', fn,
        '--base', options.base,
        '--js-cut-dev',
        '--js-info',
        '--css-info',
        '--l10n-info'
      ];

      if (!fn)
        callback('File ' + filename + ' not found');

      logMsg('fork', 'basis extract ' + args.join(' '), true);
      require('basisjs-tools-build').extract
        .fork(
          args,
          { silent: true }
        )
        .on('exit', function(code){
          if (code)
          {
            logWarn('socket', 'getFileGraph: exit ' + code);
            callback('Process exit with code ' + code);
          }
          else
          {
            logMsg('fork', 'getFileGraph: complete in ' + (new Date - startTime) + 'ms');
          }
        })
        .on('message', function(res){
          if (res.error)
          {
            logMsg('socket', 'send error on getFileGraph: ' + res.error);
            callback('Error on file map fetch: ' + res.error);
          }
          else
          {
            logMsg('socket', 'send file graph (extrating done in ' + (new Date - startTime) + 'ms)', true);
            callback(null, res.data);
          }
        });
    }
  };
};
