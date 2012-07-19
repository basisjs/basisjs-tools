
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var externalRx = /^(\s*[a-z0-9\-]:)\/\//i;

var textFiles = ['.css', '.js', '.json', '.tmpl', '.txt', '.svg', '.html'];

var typeByExt = {
  '.js': 'script',
  '.css': 'style',
  '.tmpl': 'template',
  '.html': 'html',
  '.json': 'json',
  '.xml': 'xml',
  '.svg': 'svg',
  '.bmp': 'image',
  '.gif': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.tiff': 'image'
};

var typeNotFoundHandler = {
  '.js': '/* Javascript file {filename} not found */',
  '.css': '/* CSS file {filename} not found */'
};

function getFileContentOnFailure(filename){
  return (typeNotFoundHandler[path.extname(filename)] || '').replace(/\{filename\}/, filename);
}

function unixpath(filename){
  return path.normalize(filename).replace(/\\/g, '/');
}


//
// export
//

module.exports = function(options, fconsole){
  var fileMap = {};
  var queue = [];
  var __baseURI = options.base;

  //
  // file class
  //

  function File(cfg){
    for (var key in cfg)
      this[key] = cfg[key];

    if (!this.type)
      this.type = typeByExt[this.ext] || 'unknown';
  };

  File.prototype = {
    resolve: function(filename){
      if (externalRx.test(filename))
        return filename;

      // remove everything after ? (query string) or # (hash)
      filename = filename.replace(/[\?\#].*$/, '');

      var rel = filename.replace(/^\s*\//, '');
      var result;

      if (rel == filename)
        result = path.resolve(this.baseURI, filename);
      else
        result = path.resolve(__baseURI, rel);

      return unixpath(result);
    },

    // input filename
    get basename(withExt){
      return this.filename ? path.basename(this.filename) : '';
    },
    get name(){
      return this.filename ? path.basename(this.filename, path.extname(this.filename)) : '';
    },
    get ext(){
      return this.filename ? path.extname(this.filename) : '';
    },
    get relpath(){
      return this.filename ? unixpath(path.relative(__baseURI, this.filename)) : '[no filename]';
    },

    // input baseURI
    get baseURI(){
      return unixpath(this.filename ? path.dirname(this.filename) + '/' : this.baseURI_ || '');
    },
    set baseURI(uri){
      if (!this.filename)
        this.baseURI_ = unixpath(path.resolve(__baseURI, uri) + '/');
    },

    // output filename
    get outputFilename(){
      return this.outputFilename_;
    },
    set outputFilename(filename){
      this.outputFilename_ = unixpath(filename);
    },
    get relOutputFilename(){
      return this.outputFilename || '[no output filename]';
    },

    // misc
    get digest(){
      if (!this.digest_)
      {
        var hash = crypto.createHash('md5');
        hash.update(this.outputContent || this.content);
        this.digest_ = hash.digest('base64')
          // remove trailing == which always appear on md5 digest, save 2 bytes
          .replace(/=+$/, '')
          // make digest web safe
          .replace(/\//g, '_')
          .replace(/\+/g, '-');
      }

      return this.digest_;
    },
    get encoding(){
      return this.type == 'image' /*|| textFiles.indexOf(this.ext) == -1*/ ? 'binary' : 'utf-8';
    }
  };

  function abspath(filename){
    return unixpath(path.resolve(__baseURI, filename.replace(/[\?\#].*$/, '')));
  }

  function addFile(data){
    var file;

    if (!data.filename)
    {
      file = new File(data);
    }
    else
    {
      // ignore references for external resources
      if (externalRx.test(data.filename))
      {
        // external resource
        fconsole.log('[i] External resource `' + data.filename + '` ignored');
        return;
      }

      var filename = abspath(data.filename);
                     // remove everything after ? (query string) or # (hash)
                     // and normalize

      if (fileMap[filename]) // ignore duplicates
      {
        fconsole.log('[ ] File `' + path.relative(__baseURI, filename) + '` already in queue');
        return fileMap[filename];
      }

      // create file
      data.filename = filename;
      file = new File(data);

      // read content
      if (fs.existsSync(filename))
      {
        if (fs.statSync(filename).isFile())
        {
          fconsole.log('[+] ' + file.relpath + ' (' + file.type + ')');
          file.content = fs.readFileSync(filename, file.encoding);
        }
        else
        {
          file.warn = '`' + file.relpath + '` is not a file';
        }
      }
      else
      {
        file.warn = 'File `' + file.relpath + '` not found';
      }

      if (file.warn)
      {
        fconsole.log('[WARN] ' + file.warn);
        file.content = getFileContentOnFailure(filename);
      }

      fileMap[filename] = file;
    }

    queue.add(file);

    return file;
  }

  function getFile(filename){
    var fileId = abspath(filename);

    return fileMap[fileId];
  }

  function removeFile(filename){
    var fileId = abspath(filename);

    queue.remove(fileMap[fileId]);
    delete fileMap[fileId];
  }

  function mkdir(dirpath){
    if (!fs.existsSync(dirpath))
    {
      fconsole.log('Create folder ' + dirpath);
      fs.mkdirSync(dirpath);  
    }
  }

  return {
    queue: queue,
    map: fileMap,

    add: addFile,
    get: getFile,
    remove: removeFile,
    mkdir: mkdir
  };
};