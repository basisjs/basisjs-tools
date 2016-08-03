var chalk = require('chalk');
var mime = require('mime');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var logMsg = require('./utils').logMsg;
var logError = require('./utils').logError;
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
var fsIsCaseSensitive = fs.existsSync(process.execPath.toLowerCase()) && fs.existsSync(process.execPath.toUpperCase());
var relativePath = relPathBuilder('/');
var absolutePath = function(filename){
  return path.normalize(filename);
};

function existsCaseSensitive(filename, callback){
  if (!fs.existsSync(filename))
    return callback('File not found');

  if (fsIsCaseSensitive)
  {
    var parts = path.relative(process.cwd(), filename).split(path.sep).filter(Boolean);
    var checkPath = '.';
    var part;

    while (part = parts.shift())
    {
      if (part != '..' && fs.readdirSync(checkPath).indexOf(part) == -1)
        return callback('Wrong case for `' + part + '` at `' + checkPath.replace(/^\./, '') + '`');

      checkPath += '/' + part;
    }
  }

  callback();
}

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

function getFileAttrs(file){
  var attrs = [];

  if (file.cacheName && resourceCache.has(file.cacheName))
    attrs.push('cache');
  if (file.watching)
    attrs.push('watch');
  if (file.notify)
    attrs.push('notify');

  return attrs;
}

function runCallbacks(err, filename, content){
  var callbacks = processingPaths[filename];
  var file = getFileInfo(filename, true);
  var digest = getContentDigest(content);

  for (var i = 0, callback; callback = callbacks[i]; i++)
    callback(err, filename, content, digest);

  logMsg('fs', relativePath(filename) + ' ' + chalk.green(
    '(ready: ' + getFileAttrs(file).map(function(attr){
      return chalk.yellow(attr);
    }).join(chalk.gray(', ')) + ')'
  ), true);

  file.digest = digest;
  file.error = err;
  file.mtime = fs.statSync(filename).mtime || 0;
  file.content = content;
  file.zip = {};

  if (file.content !== null)
    updateCache(filename, content);

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
      cacheName: null,
      mtime: 0,
      notify: false,
      watching: false,
      digest: null,
      content: null,
      zip: {}
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

function addToCache(filename, data, cacheName){
  var file = getFileInfo(filename, true);
  file.cacheName = cacheName || relativePath(filename);
  file.notify = true;
  resourceCache.add(cacheName, data);
}

function updateCache(filename, data){
  var file = getFileInfo(filename);
  var cacheName = (file && file.cacheName) || relativePath(filename);

  if (resourceCache.has(cacheName))
    resourceCache.add(cacheName, data);
}

module.exports = {
  getNames: getNames,
  get: getFileInfo,
  attrs: getFileAttrs,
  remove: dropFileInfo,

  exists: existsCaseSensitive,
  readFile: addFileToQueue,
  readFileIfNeeded: function(filename, callback){
    var file = getFileInfo(filename);

    if (processingPaths[filename] || !file || !file.watching || file.content === null)
      addFileToQueue(filename, callback);
    else if (typeof callback == 'function')
      callback(file.error, filename, file.content, file.digest);
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

  addToCache: addToCache,
  updateCache: updateCache,

  addPreprocessor: function(type, fn){
    if (!preprocess[type])
      preprocess[type] = [];

    var preprocessors = preprocess[type];
    var idx = preprocessors.length;

    preprocessors.push(function(filename, content){
      var intro = relativePath(filename) + chalk.gray(' → ') + chalk.yellow(fn.propercessorName || fn.name || '<anonymous-preprocessor>');
      try {
        logMsg('fs', intro, true);
        fn(content, filename, function(err, res){
          var next = preprocessors[idx + 1];

          if (err)
          {
            logError('fs', intro + ': ' + err);
            return runCallbacks(err, filename);
          }

          if (typeof next == 'function')
            next(filename, res);
          else
            runCallbacks(null, filename, res);
        });
      } catch(e) {
        logError('fs', intro + ': ' + e);
        runCallbacks(e, filename);
      }
    });
  }
};
