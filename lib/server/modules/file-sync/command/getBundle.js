var path = require('path');
var url = require('url');
var fs = require('fs');
var chalk = require('chalk');
var utils = require('../../utils');
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
    logMsg('socket', 'request ' + chalk.yellow('getBundle') + ' ' + filename);

    if (typeof callback != 'function')
    {
      logWarn('socket', 'getBundle: callback not a function');
      return;
    }

    var filepath = path.normalize(options.base + url.parse(filename, false, true).pathname);
    var fn = resolveFilename(filepath);
    var startTime = new Date;
    var args = [
      '--file', fn,
      '--base', options.base,
      '--js-cut-dev',
      '--js-bundle',
      '--target', 'none'
    ];

    if (!fn)
    {
      logWarn('socket', 'getBundle: file is not resolved (' + filepath + ')');
      callback('getBundle: file is not resolved (' + filepath + ')');
      return;
    }

    logMsg('fork', 'basis build ' + args.join(' '), true);
    require('basisjs-tools-build').build
      .fork(
        args,
        { silent: true }
      )
      .on('exit', function(code){
        if (code)
        {
          logWarn('socket', 'getBundle: exit ' + code);
          callback('Process exit with code ' + code);
        }
        else
        {
          logMsg('fork', 'getBundle: complete in ' + (new Date - startTime) + 'ms');
        }
      })
      .on('message', function(res){
        if (res.error)
        {
          logWarn('socket', 'send error on getBundle: ' + res.error);
          callback('Error on build: ' + res.error);
        }
        else if (res.event === 'done')
        {
          logMsg('socket', 'send bundle (build done in ' + (new Date - startTime) + 'ms)', true);
          // TODO: process res.deps
          callback(null, res.bundle && res.bundle.content);
        }
      });
  };
};
