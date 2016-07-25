var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var files = require('../../files');
var logMsg = require('../../utils').logMsg;
var relPathBuilder = require('../../utils').relPathBuilder;
var resourceCache = require('../../resourceCache');

module.exports = function(options, broadcast){
  var normPath = relPathBuilder(options.base);

  return function(clientData){
    var clientFiles = clientData.files;

    logMsg('socket', 'request ' + chalk.yellow('handshake') + ' (client ' + (clientFiles ? clientFiles.length : 0) + ' files)', true);

    if (Array.isArray(clientFiles))
      clientFiles.sort().forEach(function(relFilename){
        var filename = path.normalize(path.join(options.base, relFilename));

        if (!fs.existsSync(filename))
        {
          broadcast('deleteFile', {
            filename: relFilename
          });
          return;
        }

        files.readFileIfNeeded(filename, function(err, content){
          if (err)
            return;

          files.addToCache(filename, content);
        });
      });

    var serverFiles = files.getNames().map(normPath).filter(function(fnKey){
      return resourceCache.has(fnKey);
    });
    logMsg('socket', 'response ' + chalk.yellow('handshake') + ' (server ' + serverFiles.length + ' files)', true);

    this.emit('handshake', {
      files: serverFiles
    });
  };
};
