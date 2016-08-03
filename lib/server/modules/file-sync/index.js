var path = require('path');
var chalk = require('chalk');
var files = require('../files');
var logMsg = require('../utils').logMsg;

module.exports = function initFileSync(wsServer, options){
  wsServer.addClientApi(path.join(__dirname, 'ws-client-api.js'));

  // define commands -> use
  wsServer.on('connection', function(socket){
    socket.on('file:handshake', require('./command/handshake')(options));

    socket.on('file:save', require('./command/saveFile')(options));
    socket.on('file:create', require('./command/createFile')(options));
    socket.on('file:read', require('./command/readFile')(options));
  });

  // clients notification
  files.onRead(function(err, filename, content, digest){
    if (err)
      return;

    var file = files.get(filename);
    var relFilename = file.cacheName || files.relativePath(filename);

    if (!wsServer.hasClients() || /^basisjs-tools:/.test(relFilename))
      return;

    if (file.notify)
    {
      logMsg('bcast', chalk.green('file:update') + ' ' + relFilename);
      wsServer.emit('file:update', {
        filename: relFilename,
        digest: digest,
        content: content
      });
    }

    if (file.warmup)
    {
      file.warmup = false;
      file.notify = true;

      if (!options.verbose)
      {
        var attrs = files.attrs(file).join(', ');

        logMsg('info', relFilename + ' ' + chalk.green('(warmed up)') + (attrs ? ' ' + chalk.gray(attrs) : ''));
      }
    }
  });
  files.onRemove(function(filename){
    var file = files.get(filename);
    var relFilename = files.relativePath(filename);

    if (file && file.notify)
    {
      logMsg('bcast', chalk.red('file:delete') + ' ' + relFilename);
      wsServer.emit('file:delete', {
        filename: relFilename
      });
    }
  });
};
