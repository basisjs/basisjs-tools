var chalk = require('chalk');
var mime = require('mime');
var fs = require('fs');
var path = require('path');
var logMsg = require('./utils').logMsg;
var relPathBuilder = require('./utils').relPathBuilder;
var resourceCache = require('./resourceCache');

var READ_LIMIT = 64;
var readingCount = 0;
var filesToRead = [];
var processingPaths = {};
var readCallbacks = [];
var preprocess = {};
var fileMap = {};
var addCallbacks = [];
var removeCallbacks = [];
var processPath = relPathBuilder('/');

function checkQueue(){
  if (readingCount < READ_LIMIT && filesToRead.length)
    readFile(filesToRead.shift());
}

// processingPaths[key] -> [callbackN .. callback1 onRead1 ... onReadN]
function addFileToQueue(filename, callback){
  if (processingPaths[filename]) {
    if (typeof callback == 'function')
      processingPaths[filename].unshift(callback);

    return;
  }

  processingPaths[filename] = typeof callback == 'function'
    ? [callback].concat(readCallbacks)
    : readCallbacks.slice();

  if (readingCount < READ_LIMIT)
    readFile(filename);
  else
  {
    logMsg('fs', processPath(filename) + ' ' + chalk.yellow('(add file to queue)'), true);
    filesToRead.push(filename);
  }
}

function readFile(filename){
  var contentType = mime.lookup(filename, 'text/plain');
  var isTextFile = /^text\/|^application\/(javascript|json|.+\+xml$)|\+xml$/.test(contentType);

  readingCount++;

  logMsg('fs', processPath(filename) + ' ' + chalk.yellow('(start reading)'), true);
  fs.readFile(filename, isTextFile ? 'utf8' : null, function(err, content){
    logMsg('fs', processPath(filename) + ' ' + chalk.yellow('(read)'), true);

    readingCount--;
    checkQueue();

    var preprocessors = preprocess[path.extname(filename)];
    if (!err && preprocessors)
    {
      logMsg('fs', processPath(filename) + ' ' + chalk.yellow('(preprocess)'), true);
      preprocessors[0](filename, content);
    }
    else
      runCallbacks(err, filename, content);
  });
}

function runCallbacks(err, filename, content){
  var callbacks = processingPaths[filename];
  var file = getFileInfo(filename, true);

  for (var i = 0, callback; callback = callbacks[i]; i++)
    callback(err, content, filename);

  logMsg('fs', processPath(filename) + ' ' + chalk.gray(
    '(' + chalk.green('ready') +
    (resourceCache.has(processPath(filename)) ? ', ' + chalk.yellow('in cache') : '') +
    (file.watching ? ', ' + chalk.yellow('watching') : '') +
    (file.notify ? ', ' + chalk.yellow('notify') : '') +
    ')'
  ));

  file.error = err;
  file.mtime = fs.statSync(filename).mtime || 0;
  file.content = content;

  delete processingPaths[filename];
}

function getNames(){
  return Object.keys(fileMap);
}

function getFileInfo(filename, autocreate){
  filename = path.normalize(filename);

  var fileInfo = fileMap[filename];

  if (!fileInfo && autocreate)
  {
    fileInfo = fileMap[filename] = {
      filename: filename,
      mtime: 0,
      notify: false,
      watching: false,
      content: null
    };

    addCallbacks.forEach(function(fn){
      fn(filename);
    });
  }

  return fileInfo;
}

function dropFileInfo(filename){
  filename = path.normalize(filename);

  var fileInfo = fileMap[filename];

  if (fileInfo)
  {
    removeCallbacks.forEach(function(fn){
      fn(filename);
    });

    delete fileMap[filename];

    resourceCache.remove(processPath(filename));
  }
}

module.exports = {
  getNames: getNames,
  getInfo: getFileInfo,
  dropInfo: dropFileInfo,
  readFile: addFileToQueue,
  readFileIfNeeded: function(filename, callback){
    if (processingPaths[filename] || !getFileInfo(filename))
    {
      addFileToQueue(filename, callback);
    }
    else if (typeof callback == 'function')
    {
      var file = getFileInfo(filename);
      callback(file.error, file.content, filename);
    }
  },

  setBase: function(base){
    processPath = relPathBuilder(base);
  },
  relativePath: function(path){
    return processPath(path);
  },

  onAdd: function(callback){
    addCallbacks.push(callback);
  },
  onRemove: function(callback){
    removeCallbacks.push(callback);
  },
  onRead: function(callback){
    for (var filename in processingPaths)
      processingPaths[filename].push(callback);

    readCallbacks.push(callback);
  },

  addToCache: function(filename, data){
    resourceCache.add(processPath(filename), data);
    getFileInfo(filename, true).notify = true;
  },
  updateCache: function(filename, data){
    var relPath = processPath(filename);

    if (resourceCache.has(relPath))
      resourceCache.add(relPath, data);
  },

  addPreprocessor: function(type, fn, baseURI){
    if (!preprocess[type])
      preprocess[type] = [];

    var preprocessors = preprocess[type];
    var idx = preprocessors.length;

    preprocessors.push(function(filename, content){
      try {
        fn(content, filename, function(err, res){
          var next = preprocessors[idx + 1];

          if (err)
            return runCallbacks(err, filename);

          if (typeof next == 'function')
            next(filename, res);
          else
            runCallbacks(null, filename, res);
        });
      } catch(e) {
        runCallbacks(e, filename);
      }
    });
  }
};
