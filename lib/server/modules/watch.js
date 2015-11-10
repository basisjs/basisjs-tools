var path = require('path');
var fs = require('fs');
var files = require('./files');
var chalk = require('chalk');
var logMsg = require('./utils').logMsg;
var logWarn = require('./utils').logWarn;

var watchFolders = {};
var queue = new Set();
var queueTimer;

function normPath(filename){
  // nothing to do for now
  // TODO: convert to relative paths
  return filename;
}

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
      add: function(filename){
        if (this.files.has(filename))
          return;

        if (!this.watcher)
          this.watcher = getWatcher(this);

        logMsg('watcher', normPath(filename) + ' ' + chalk.green('(start watch)'), true);
        this.files.add(filename);

        // if (process.platform != 'win32')
        // {
        //   logMsg('watcher', normPath(filename) + ' ' + chalk.yellow('(add file watcher)'), true);
        //   fs.watchFile(filename, { interval: 200 }, function(curr, prev){
        //     onWatchEvent(filename, dirInfo);
        //   });
        // }
      },
      remove: function(filename){
        if (!this.files.has(filename))
          return;

        logMsg('watcher', normPath(filename) + ' ' + chalk.red('(stop watch)'), true);
        this.files.delete(filename);

        if (!this.files.size && this.watcher)
        {
          logMsg('watcher', normPath(this.path) + ' ' + chalk.red('(stop watch dir)'), true);
          this.watcher.close();
          this.watcher = null;
        }

        // fs.unwatchFile(filename);
      },
      has: function(filename){
        return this.files.has(filename);
      }
    };
  }

  return dirInfo;
}

module.exports = {
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
