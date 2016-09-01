var path = require('path');
var url = require('url');
var fs = require('fs');
var resolve = require('resolve');
var chalk = require('chalk');
var utils = require('../utils');
var logMsg = utils.logMsg;
var logError = utils.logError;

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
    logMsg('socket', 'request ' + chalk.yellow('getAppProfile') + ' ' + filename);

    if (typeof callback != 'function')
    {
      logError('socket', chalk.yellow('getAppProfile') + ' callback not a function');
      return;
    }

    var filepath = path.normalize(options.base + url.parse(filename, false, true).pathname);
    var indexFilename = resolveFilename(filepath);
    var startTime = new Date;
    var args = [
      '--file', indexFilename,
      '--base', options.base,
      '--js-cut-dev',
      '--js-info',
      '--css-info',
      '--l10n-info'
    ];

    if (!indexFilename)
    {
      logError('socket', chalk.yellow('getAppProfile') + ' file is not resolved (' + filepath + ')');
      callback('getAppProfile: file is not resolved (' + filepath + ')');
      return;
    }

    logMsg('fork', 'basis extract ' + args.join(' '), true);
    require('basisjs-tools-build').extract
      .fork(
        args,
        { silent: true }
      )
      .on('exit', function(code){
        if (code)
        {
          logError('socket', chalk.yellow('getAppProfile') + ' Exit code ' + code);
          logError('socket', chalk.yellow('getAppProfile') + ' Command for issue investigation:\n> ' +
            'node ' + path.resolve(resolve.sync('basisjs-tools-build'), '../../bin/extract') + ' ' +
            args.concat('--no-config', '--target', 'log').join(' ')
          );
          callback('Process exit with code ' + code);
        }
        else
        {
          logMsg('fork', chalk.yellow('getAppProfile') + ' complete in ' + (new Date - startTime) + 'ms');
        }
      })
      .on('message', function(res){
        if (res.error)
        {
          logError('socket', chalk.yellow('getAppProfile') + ' ' + res.error);
          callback('Error on app profile fetch: ' + res.error);
        }
        else
        {
          logMsg('socket', chalk.yellow('getAppProfile') + ' send app profile (extract done in ' + (new Date - startTime) + 'ms)', true);
          callback(null, JSON.parse(res.data));
        }
      });
  };
};
