var mime = require('mime');
var fs = require('fs');
var path = require('path');

var READ_LIMIT = 64;
var readingCount = 0;
var filesToRead = [];
var processingPaths = {};
var readCallbacks = [];
var preprocess = {};
var fileMap = {};
var addCallbacks = [];
var removeCallbacks = [];

function checkQueue(){
  if (readingCount < READ_LIMIT && filesToRead.length)
    readFile(filesToRead.shift());
}

function addFileToQueue(filename, callback){
  if (processingPaths[filename]) {
    if (typeof callback == 'function')
      processingPaths[filename].push(callback);

    return;
  }

  processingPaths[filename] = typeof callback == 'function'
    ? readCallbacks.concat(callback)
    : readCallbacks.slice();

  if (readingCount < READ_LIMIT)
    readFile(filename);
  else
    filesToRead.push(filename);
}

function readFile(filename){
  var contentType = mime.lookup(filename, 'text/plain');
  var isTextFile = /^text\/|^application\/(javascript|json|.+\+xml$)|\+xml$/.test(contentType);

  readingCount++;

  fs.readFile(filename, isTextFile ? 'utf8' : null, function(err, content){
    readingCount--;
    checkQueue();

    var preprocessors = preprocess[path.extname(filename)];
    if (!err && preprocessors)
      preprocessors[0](filename, content);
    else
      runCallbacks(err, filename, content);
  });
}

function runCallbacks(err, filename, content){
  var callbacks = processingPaths[filename];

  for (var i = 0, callback; callback = callbacks[i]; i++)
    callback(err, content, filename);

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
    delete fileMap[filename];

    removeCallbacks.forEach(function(fn){
      fn(filename);
    });
  }
}

module.exports = {
  getNames: getNames,
  getInfo: getFileInfo,
  dropInfo: dropFileInfo,
  readFile: addFileToQueue,

  onAdd: function(callback){
    addCallbacks.push(callback);
  },
  onRemove: function(callback){
    removeCallbacks.push(callback);
  },
  onRead: function(callback){
    var pos = readCallbacks.length;

    for (var filename in processingPaths)
      processingPaths[filename].splice(pos, 0, filename);

    readCallbacks.push(callback);
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
