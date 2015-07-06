var mime = require('mime');
var fs = require('fs');
var path = require('path');

var READ_LIMIT = 64;
var readingCount = 0;
var filesToRead = [];
var processingPaths = {};
var readCallbacks = [];
var preprocess = {};

function checkQueue(){
  if (readingCount < READ_LIMIT && filesToRead.length)
    readFile(filesToRead.shift());
}

function addFileToQueue(fn, callback){
  if (processingPaths[fn]) {
    if (typeof callback == 'function')
      processingPaths[fn].push(callback);

    return;
  }

  processingPaths[fn] = typeof callback == 'function'
    ? readCallbacks.concat(callback)
    : readCallbacks.slice();

  if (readingCount < READ_LIMIT)
    readFile(fn);
  else
    filesToRead.push(fn);
}

function readFile(fn){
  var contentType = mime.lookup(fn, 'text/plain');
  var isTextFile = /^text\/|^application\/(javascript|json|.+\+xml$)|\+xml$/.test(contentType);

  readingCount++;

  fs.readFile(fn, isTextFile ? 'utf8' : null, function(err, content){
    readingCount--;
    checkQueue();

    var preprocessors = preprocess[path.extname(fn)];
    if (!err && preprocessors)
      preprocessors[0](fn, content);
    else
      runCallbacks(err, fn, content);
  });
}

function runCallbacks(err, filename, content){
  var callbacks = processingPaths[filename];

  for (var i = 0, callback; callback = callbacks[i]; i++)
    callback(err, content, filename);

  delete processingPaths[filename];
}

module.exports = {
  readFile: addFileToQueue,
  addReadCallback: function(fn){
    var pos = readCallbacks.length;

    for (var fn in processingPaths)
      processingPaths[fn].splice(pos, 0, fn);

    readCallbacks.push(fn);
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
