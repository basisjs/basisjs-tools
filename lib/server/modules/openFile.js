var openInEditor = require('open-in-editor');
var chalk = require('chalk');
var virtualPath = require('./virtualPath');
var files = require('./files');
var utils = require('./utils');
var logMsg = utils.logMsg;
var logWarn = utils.logWarn;
var options;
var editor;

function openFile(filename, callback){
  editor
    .open(files.absolutePath(filename))
    .then(callback, function(err){
      logWarn('cli', 'openFile: ' + String(err).replace(/[\r\n]+$/, ''));
      callback('openFile error: ' + err);
    });
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
  init: function(options_){
    options = options_;
    editor = openInEditor.configure({
      editor: options.editor
    }, function(err){
      openFile = function(){
        logWarn('cli', 'openFile doesn\'t work. See reason on server start');
      };

      console.error(chalk.bgRed('ERROR') + ' openFile: ' + err);
    });
  }
};
