var fs = require('fs');
var chalk = require('chalk');
var files = require('../../files');
var logMsg = require('../../utils').logMsg;
var resourceCache = require('../../resourceCache');

function filenameSorting(file1, file2){
  return file1.filename > file2.filename ? 1 : -1;
}

module.exports = function(options, broadcast){
  return function(clientData){
    var clientFiles = clientData.files;
    var socket = this;

    logMsg('socket', 'request ' + chalk.yellow('handshake') + ' (client ' + (clientFiles ? clientFiles.length : 0) + ' files)', true);

    if (Array.isArray(clientFiles))
      clientFiles.sort(filenameSorting).forEach(function(file){
        var filename = files.absolutePath(file.filename);

        if (!fs.existsSync(filename))
        {
          broadcast('deleteFile', {
            filename: file.filename
          });
          return;
        }

        files.readFileIfNeeded(filename, function(err, filename, content, digest){
          if (err)
            return;

          files.addToCache(filename, content);

          if (file.digest !== digest)
          {
            logMsg('socket', chalk.yellow('updateFile') + ' ' + file.filename);
            socket.send('updateFile', {
              filename: filename,
              digest: digest,
              content: content
            });
          }
        });
      });

    var serverFiles = files.getNames()
      .map(function(filename){
        return {
          filename: files.relativePath(filename),
          digest: files.get(filename).digest
        };
      })
      .filter(function(file){
        return resourceCache.has(file.filename);
      });
    logMsg('socket', 'response ' + chalk.yellow('handshake') + ' (server ' + serverFiles.length + ' files)', true);

    this.emit('handshake', {
      files: serverFiles
    });
  };
};
