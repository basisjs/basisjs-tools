var path = require('path');
var chalk = require('chalk');
var files = require('../files');
var logMsg = require('../utils').logMsg;

module.exports = function initFileSync(wsServer, options){
  wsServer.addClientApi(path.join(__dirname, 'client.js'));

  // define commands -> use
  wsServer.on('connection', function(socket){
    socket.on('saveFile', require('./command/saveFile')(options));
    socket.on('createFile', require('./command/createFile')(options));
    socket.on('readFile', require('./command/readFile')(options));

    socket.on('handshake', require('./command/handshake')(options));
    socket.on('openFile', require('./command/openFile')(options));
    socket.on('getAppProfile', require('./command/getAppProfile')(options));
    socket.on('getBundle', require('./command/getBundle')(options));

    // temporary here
    // TODO: move to proper place
    socket.on('basisjs.devpanel.command', function(data){
      socket.broadcast.emit('basisjs.devpanel.command', data);
    });
    socket.on('basisjs.devpanel.data', function(data){
      socket.broadcast.emit('basisjs.devpanel.data', data);
    });
  });

  // clients notification
  files.onRead(function(err, filename, content, digest){
    if (err)
      return;

    var file = files.get(filename);
    var relFilename = files.relativePath(filename);

    if (!wsServer.hasClients() || /^basisjs-tools:/.test(relFilename))
      return;

    if (file.notify)
    {
      logMsg('bcast', chalk.green('updateFile') + ' ' + relFilename);
      wsServer.emit('updateFile', {
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
      logMsg('bcast', chalk.red('deleteFile') + ' ' + relFilename);
      wsServer.emit('deleteFile', {
        filename: relFilename
      });
    }
  });

  return initFileSync;
};
