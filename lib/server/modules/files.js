var mime = require('mime');
var fs = require('fs');

var READ_LIMIT = 64;
var readingCount = 0;
var filesToRead = [];
var processingPaths = {};
var readCallbacks = [];

function checkQueue(){
  if (readingCount < READ_LIMIT && filesToRead.length)
    readFile(filesToRead.shift());
}

function readFile(fn){
  var contentType = mime.lookup(fn, 'text/plain');
  var isTextFile = /^text\/|^application\/(javascript|json|.+\+xml$)|\+xml$/.test(contentType);

  if (require('path').extname(fn) == '.dot')
    isTextFile = true;

  readingCount++;
  fs.readFile(fn, isTextFile ? 'utf8' : null, function(err, content){
    var callbacks = processingPaths[fn];

    delete processingPaths[fn];
    readingCount--;

    for (var i = 0, callback; callback = callbacks[i]; i++)
      callback(err, content, fn);

    checkQueue();
  });
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

module.exports = {
  readFile: addFileToQueue,
  addReadCallback: function(fn){
    var pos = readCallbacks.length;

    for (var fn in processingPaths)
      processingPaths[fn].splice(pos, 0, fn);

    readCallbacks.push(fn);
  }
};
