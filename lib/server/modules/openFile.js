var child_process = require('child_process');
var path = require('path');
var chalk = require('chalk');
var virtualPath = require('./virtualPath');
var utils = require('./utils');
var logMsg = utils.logMsg;
var logWarn = utils.logWarn;
var options;

function openFile(filename, callback){
  filename = path.resolve(options.base, filename);

  if (typeof callback != 'function')
    callback = function(){};

  if (options.editor)
  {
    var cmd = options.editor + ' ' + filename;

    logMsg('cmd', cmd, true);
    child_process.exec(cmd, function(err){
      if (err)
      {
        logWarn('cli', 'openFile: ' + String(err).replace(/[\r\n]+$/, ''));
        callback('Run command error: ' + err);
        return;
      }

      callback();
    });
  }
  else
  {
    logWarn('cli', 'Editor command is no specified, request ignored');
    callback('Editor command is no specified, request ignored');
  }
};

virtualPath.add('/basisjs-tools/open-in-editor', function(api){
  function responseError(message){
    api.responseToClient('ERROR: ' + message, { status: 500, contentType: 'text/plain' });
  }

  logMsg('client', api.location.pathname + chalk.green(api.location.search));

  if (!api.location.query.file)
  {
    var message = 'File is missed. Use query param `file`: /basisjs-tools/open-in-editor?file=filename:line:column';
    logWarn('client', message);
    return responseError(message);
  }

  openFile(api.location.query.file, function(err){
    if (err)
      return responseError(err);
    api.responseToClient('OK', { contentType: 'text/plain' });
  });
});

module.exports = {
  open: openFile,
  setOptions: function(o){
    options = o;
  }
};
