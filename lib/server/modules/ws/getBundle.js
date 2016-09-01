var path = require('path');
var url = require('url');
var fs = require('fs');
var resolve = require('resolve');
var chalk = require('chalk');
var utils = require('../utils');
var files = require('../files');
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
  return function(config, callback){
    var filename = config;

    logMsg('socket', 'request ' + chalk.yellow('getBundle') + ' ' + (typeof filename === 'string' ? filename : JSON.stringify(filename)));

    if (typeof callback != 'function')
    {
      logError('socket', chalk.yellow('getBundle') + ' callback not a function');
      return;
    }

    if (config && typeof config !== 'string')
    {
      if (config.build)
      {
        filename = files.absolutePath(config.build);
        if (fs.existsSync(filename))
        {
          logMsg('socket', chalk.yellow('getBundle') + ' fetch built bundle ' + config.build, true);
          fs.readFile(filename, 'utf-8', function(err, content){
            callback(err, content);
          });
          return;
        }
      }

      filename = config.filename;
    }

    var filepath = path.normalize(options.base + url.parse(filename, false, true).pathname);
    var indexFilename = resolveFilename(filepath);
    var startTime = new Date;
    var args = [
      '--file', indexFilename,
      '--base', options.base,
      '--js-cut-dev',
      '--js-bundle', 'json',
      '--target', 'none'
    ];

    if (!indexFilename)
    {
      logError('socket', chalk.yellow('getBundle') + ' file is not resolved (' + filepath + ')');
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
          logError('socket', chalk.yellow('getBundle') + ' Exit code ' + code);
          logError('socket', chalk.yellow('getBundle') + ' Command for issue investigation:\n> ' +
            'node ' + path.resolve(resolve.sync('basisjs-tools-build'), '../../bin/build') + ' ' +
            args.concat('--no-config', '--verbose').join(' ')
          );
          callback('Process exit with code ' + code);
        }
        else
        {
          logMsg('fork', chalk.yellow('getBundle') + ' complete in ' + (new Date - startTime) + 'ms');
        }
      })
      .on('message', function(res){
        if (res.error)
        {
          logError('socket', chalk.yellow('getBundle') + ' ' + res.error);
          callback('Error on build: ' + res.error);
        }
        else if (res.event === 'done')
        {
          logMsg('socket', chalk.yellow('getBundle') + ' send bundle (build done in ' + (new Date - startTime) + 'ms)', true);
          // TODO: process res.deps
          callback(null, res.bundle && res.bundle.content);
        }
      });
  };
};
