var chalk = require('chalk');
var mime = require('mime');
var crypto = require('crypto');
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
var relativePath = relPathBuilder('/');
var absolutePath = function(filename){
  return path.notmalize(filename);
};

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
    logMsg('fs', relativePath(filename) + ' ' + chalk.yellow('(add file to queue)'), true);
    filesToRead.push(filename);
  }
}

function readFile(filename){
  var contentType = mime.lookup(filename, 'text/plain');
  var isTextFile = /^text\/|^application\/(javascript|json|.+\+xml$)|\+xml$/.test(contentType);

  readingCount++;

  logMsg('fs', relativePath(filename) + ' ' + chalk.yellow('(start reading)'), true);
  fs.readFile(filename, isTextFile ? 'utf8' : null, function(err, content){
    logMsg('fs', relativePath(filename) + ' ' + chalk.yellow('(read)'), true);

    readingCount--;
    checkQueue();

    var preprocessors = preprocess[path.extname(filename)];
    if (!err && preprocessors)
    {
      logMsg('fs', relativePath(filename) + ' ' + chalk.yellow('(preprocess)'), true);
      preprocessors[0](filename, content);
    }
    else
      runCallbacks(err, filename, content);
  });
}

function getContentDigest(content){
  var hash = crypto.createHash('md5');
  hash.update(content || '');
  return hash.digest('base64');
}

function runCallbacks(err, filename, content){
  var callbacks = processingPaths[filename];
  var file = getFileInfo(filename, true);
  var digest = getContentDigest(content);

  for (var i = 0, callback; callback = callbacks[i]; i++)
    callback(err, filename, content, digest);

  logMsg('fs', relativePath(filename) + ' ' + chalk.gray(
    '(' + chalk.green('ready') +
    (resourceCache.has(relativePath(filename)) ? ', ' + chalk.yellow('in cache') : '') +
    (file.watching ? ', ' + chalk.yellow('watching') : '') +
    (file.notify ? ', ' + chalk.yellow('notify') : '') +
    ')'
  ));

  file.digest = digest;
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
      digest: null,
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

    resourceCache.remove(relativePath(filename));
  }
}

module.exports = {
  getNames: getNames,
  get: getFileInfo,
  remove: dropFileInfo,
  readFile: addFileToQueue,
  readFileIfNeeded: function(filename, callback){
    if (processingPaths[filename] || !getFileInfo(filename))
    {
      addFileToQueue(filename, callback);
    }
    else if (typeof callback == 'function')
    {
      var file = getFileInfo(filename);
      callback(file.error, filename, file.content, file.digest);
    }
  },

  setBase: function(base){
    relativePath = relPathBuilder(base);
    absolutePath = function(filename){
      return path.normalize(path.join(base, filename));
    };
  },
  relativePath: function(path){
    return relativePath(path);
  },
  absolutePath: function(path){
    return absolutePath(path);
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
    resourceCache.add(relativePath(filename), data);
    getFileInfo(filename, true).notify = true;
  },
  updateCache: function(filename, data){
    var relPath = relativePath(filename);

    if (resourceCache.has(relPath))
      resourceCache.add(relPath, data);
  },

  addPreprocessor: function(type, fn){
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
