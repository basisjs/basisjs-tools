
var path = require('path');
var fs = require('fs');

var textFiles = ['.css', '.js', '.json', '.tmpl', '.txt', '.svg', '.html'];
//var moveToQueueEndFile = ['.css'];
var typeByExt = {
  '.js': 'script',
  '.css': 'style',
  '.tmpl': 'template'
};
var typeNotFoundHandler = {};

function relpath(filename){
  return path.relative('.', filename).replace(/\\/g, '/');
}

module.exports = function(flowData){
  var fileMap = {};
  var queue = [];
  var options = flowData.options;

  var BASE_PATH = path.normalize(flowData.baseURI);
  var FILENAME = options.file;
  var BASENAME = path.basename(flowData.buildFile, path.extname(flowData.buildFile));
  var INDEX_FILE = path.resolve(BASE_PATH, FILENAME);
  var INDEX_PATH = path.dirname(INDEX_FILE) + '/';
  var BUILD_DIR = path.resolve(BASE_PATH, 'build');
  var BUILD_RESOURCE_DIR = BUILD_DIR + '/res';

  mkdir(BUILD_DIR);
  mkdir(BUILD_RESOURCE_DIR);

  function mkdir(dirpath){
    dirpath = path.resolve(flowData.baseURI, dirpath);

    if (!path.existsSync(dirpath))
      fs.mkdirSync(dirpath);  
  }

  function addFile(data){
    if (data.filename)
    {
      var filename = data.filename;
      var ext = path.extname(filename);

      if (fileMap[filename]) // ignore duplicates
      {
        console.log('[DUP] File `' + relpath(filename) + '` already in queue');

        /*if (moveToQueueEndFile.indexOf(ext) != -1)
        {
          queue.remove(fileMap[filename]);
          queue.add(fileMap[filename]);
        }*/

        return fileMap[filename];
      }

      if (path.existsSync(filename) && fs.statSync(filename).isFile())
      {
        console.log('[+] New file `' + relpath(filename) + '` added');
        data.content = fs.readFileSync(filename, textFiles.indexOf(ext) != -1 ? 'utf-8' : 'binary');
      }
      else
      {
        console.log('[WARN] File `' + relpath(filename) + '` not found');
        data.content = typeNotFoundHandler[ext] ? typeNotFoundHandler[ext](filename) : '';
      }

      if (typeByExt[ext])
      {
        data.type = typeByExt[ext];
        console.log(data.type);
      }

      fileMap[filename] = data;
    }

    queue.add(data);

    return data;
  }

  function getFile(filename){
    return fileMap[filename];
  }

  function removeFile(filename){
    queue.remove(fileMap[filename]);
    delete fileMap[filename];
  }  

  flowData.files = {
    queue: queue,
    map: fileMap,
    add: addFile,
    get: getFile,
    remove: removeFile,
    mkdir: mkdir,
    relpath: function(filename){
      return path.relative(flowData.baseURI, filename).replace(/\\/g, '/');
    },
    inspect: function(file){
      var result = {};

      for (var key in file)
        if (file.hasOwnProperty(key) && key !== 'content')
          result[key] = file[key];

      return result;
    },
    addNotFoundHandler: function(ext, fn){
      typeNotFoundHandler[ext] = fn;
    }
  };
};