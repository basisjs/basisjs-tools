var path = require('path');
var fs = require('fs');
var files = require('./files');
var chalk = require('chalk');
var logMsg = require('./utils').logMsg;
var logWarn = require('./utils').logWarn;
var relPathBuilder = require('./utils').relPathBuilder;

var normPath = relPathBuilder('/');
var watchFolders = {};
var awaitFiles = new Set();
var queue = new Set();
var queueTimer;


function processQueue(){
  queueTimer = clearTimeout(queueTimer);

  // re-read files
  queue.forEach(function updateFile(filename){
    if (!fs.existsSync(filename))
      return files.dropInfo(filename);

    logMsg('watcher', normPath(filename) + ' ' + chalk.yellow('(update file)'), true);
    files.readFile(filename);
  });

  // reset queue
  queue.clear();
}

function onWatchEvent(filename, dirInfo){
  logMsg('watcher', normPath(filename) + ' ' + chalk.magenta('(event)'), true);

  var fileInfo = files.getInfo(filename);

  if (!fileInfo || !fs.existsSync(filename))
    return files.dropInfo(filename);

  var stats = fs.statSync(filename);
  if (stats.mtime > (fileInfo.mtime || 0))
  {
    fileInfo.mtime = stats.mtime;
    queue.add(filename);
    if (!queueTimer)
      queueTimer = setTimeout(processQueue, 100);
  }
}

function getWatcher(dirInfo){
  if (!fs.existsSync(dirInfo.path))
    return;

  logMsg('watcher', normPath(dirInfo.path) + ' ' + chalk.green('(start watch dir)'), true);

  return fs.watch(dirInfo.path)
    .on('change', function(event, filename){
      if (filename)
      {
        // file updated
        filename = path.join(dirInfo.path, filename);
        if (dirInfo.files.has(filename))
          onWatchEvent(filename, dirInfo);
        else if (dirInfo.awaitFiles.has(filename))
        {
          dirInfo.awaitFiles.delete(filename);
          files.readFile(filename, function(err, filename, content){
            if (!err)
              files.addToCache(filename, content);
          });
        }
      }
      else
      {
        // file deleted
        dirInfo.files.forEach(function(filename){
          if (!fs.existsSync(filename))
            files.dropInfo(filename);
        });
      }
    })
    .on('error', function(error){
      logWarn('watcher', 'error (' + normPath(dirInfo.path) + '):' + error);

      if (fs.existsSync(dirInfo.path))
        return;

      logMsg('watcher', normPath(dirInfo.path) + ' ' + chalk.red('(stop watch dir)'));

      dirInfo.files.forEach(function(filename){
        files.dropInfo(filename);
        dirInfo.remove(filename);
      });

      delete watchFolders[dirInfo.path];
    });
}

function getDirWatcher(filename){
  var dirPath = path.dirname(filename);
  var dirInfo = watchFolders[dirPath];

  if (!dirInfo)
  {
    dirInfo = watchFolders[dirPath] = {
      path: dirPath || '.',
      watcher: null,
      files: new Set(),
      awaitFiles: new Set(),
      add: function(filename){
        if (this.files.has(filename))
          return;

        if (!this.watcher)
          this.watcher = getWatcher(this);

        logMsg('watcher', normPath(filename) + ' ' + chalk.green('(start watch)'), true);
        files.getInfo(filename).watching = true;
        this.files.add(filename);
      },
      remove: function(filename){
        if (!this.files.has(filename))
          return;

        logMsg('watcher', normPath(filename) + ' ' + chalk.red('(stop watch)'), true);
        files.getInfo(filename).watching = false;
        this.files.delete(filename);

        if (!this.files.size && !this.awaitFiles.size && this.watcher)
        {
          logMsg('watcher', normPath(this.path) + ' ' + chalk.red('(stop watch dir)'), true);
          this.watcher.close();
          this.watcher = null;
        }
      },
      has: function(filename){
        return this.files.has(filename);
      },
      await: function(filename){
        if (this.awaitFiles.has(filename))
          return;

        if (!this.watcher)
          this.watcher = getWatcher(this);

        logMsg('watcher', normPath(filename) + ' ' + chalk.yellow('(await for existence)'), true);
        this.awaitFiles.add(filename);
      }
    };
  }

  return dirInfo;
}

module.exports = {
  setBase: function(base){
    normPath = relPathBuilder(base);
  },
  awaitFile: function(filename){
    getDirWatcher(filename).await(filename);
  },
  startWatch: function(filename){
    getDirWatcher(filename).add(filename);
  },
  stopWatch: function(filename){
    getDirWatcher(filename).remove(filename);
  },
  isFileObserve: function(filename){
    return getDirWatcher(filename).has(filename);
  }
};
