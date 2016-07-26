var chalk = require('chalk');
var files = require('../files');
var logMsg = require('../utils').logMsg;

module.exports = function initFileSync(wsServer, options){
  wsServer.addClientApi(require.resolve('./client.js'));

  // define commands -> use
  wsServer.on('connection', function(socket){
    socket.on('saveFile', require('./command/saveFile.js')(options));
    socket.on('createFile', require('./command/createFile.js')(options));
    socket.on('readFile', require('./command/readFile.js')(options));

    socket.on('openFile', require('./command/openFile.js')(options));
    socket.on('getFileGraph', require('./command/getFileGraph.js')(options));
    socket.on('handshake', require('./command/handshake.js')(options));
  });

  // clients notification
  files.onRead(function(err, filename, content, digest){
    if (err)
      return;

    var file = files.get(filename);
    var relFilename = files.relativePath(filename);

    if (!wsServer.hasClients() || /^basisjs-tools:/.test(relFilename))
      return;

    if (file.notify && file.content !== null)
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
