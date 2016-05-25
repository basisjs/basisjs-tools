var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var files = require('../files');
var logMsg = require('../utils').logMsg;
var relPathBuilder = require('../utils').relPathBuilder;
var fsWatcher = require('../watch');
var hotStartCache = require('../resourceCache');

module.exports = function(options, broadcast){
  var normPath = relPathBuilder(options.base);

  return function(clientData){
    var clientFiles = clientData.files;

    logMsg('socket',
      'request ' + chalk.yellow('handshake') + ' (client ' + (clientFiles ? clientFiles.length : 0) + ' files)', true);

    if (Array.isArray(clientFiles))
      clientFiles.sort().forEach(function(relFilename){
        var filename = path.normalize(options.base + '/' + relFilename);

        if (!fs.existsSync(filename))
        {
          broadcast('deleteFile', {
            filename: relFilename
          });
          return;
        }

        if (fsWatcher)
          fsWatcher.startWatch(filename);

        files.readFile(filename, function(err, content){
          if (!err)
            hotStartCache.add(relFilename, content);
        });
      });

    var serverFiles = files.getNames().map(normPath).filter(function(fnKey){
      return hotStartCache.has(fnKey);
    });
    logMsg('socket', 'response ' + chalk.yellow('handshake') + ' (server ' + serverFiles.length + ' files)', true);

    this.emit('handshake', {
      editorEnabled: !!options.editor,
      files: serverFiles
    });
  };
};
