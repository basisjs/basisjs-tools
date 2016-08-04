var openInEditor = require('open-in-editor');
var chalk = require('chalk');

module.exports = function(api, config, options){
  function openFile(filename, callback){
    editor
      .open(api.absolutePath(filename))
      .then(callback, function(err){
        api.warn('cli error: ' + String(err).replace(/[\r\n]+$/, ''));
        callback('openFile error: ' + err);
      });
  };

  function openByUrl(httpApi){
    function responseError(message){
      httpApi.responseToClient('ERROR: ' + message, { status: 500, contentType: 'text/plain' });
    }

    httpApi.log(httpApi.location.pathname + chalk.green(httpApi.location.search));

    if (!httpApi.location.query.file)
    {
      var message = 'File is missed. Use query param `file`: /basisjs-tools/open-in-editor?file=filename:line:column';
      httpApi.warn(message);
      return responseError(message);
    }

    openFile(httpApi.location.query.file, function(err){
      if (err)
        return responseError(err);
      httpApi.responseToClient('OK', { contentType: 'text/plain' });
    });
  }

  function openBySocket(filename, callback){
    api.log('socket', 'request ' + chalk.yellow('openFile') + ' ' + filename);

    openFile(
      filename.replace(/^\//, ''),
      callback
    );
  }

  api.addVirtualFile('/basisjs-tools/open-in-editor', openByUrl);
  api.addSocketCommand('file:open', openBySocket);

  var editor = openInEditor.configure({
    editor: options.editor
  }, function(err){
    openFile = function(){
      api.warn('Not supported. See reason on server start');
    };

    api.error(err);
  });
};
