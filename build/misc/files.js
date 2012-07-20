
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var externalRx = /^(\s*[a-z0-9\-]:)\/\//i;
var absRx = /^\s*\//;
var queryAndHashRx = /[\?\#].*$/;
var slashRx = /\\/g;

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
  return path.normalize(filename).replace(slashRx, '/');
}

function abspath(baseURI, filename){
  return unixpath(path.resolve(baseURI, filename.replace(queryAndHashRx, '')));
}

function isExternal(uri){
  return externalRx.test(uri);
}

/**
 * @class File
 */

function File(manager, cfg){
  this.manager = manager;
  this.linkTo = [];
  this.linkBack = [];

  for (var key in cfg)
    this[key] = cfg[key];

  if (!this.type)
    this.type = typeByExt[this.ext] || 'unknown';
};

File.prototype = {
  resolve: function(filename){
    if (isExternal(filename))
      return filename;

    // remove everything after ? (query string) or # (hash)
    filename = filename.replace(queryAndHashRx, '');

    var rel = filename.replace(absRx, '');
    var result;

    if (rel == filename)
      result = path.resolve(this.baseURI, filename);
    else
      result = path.resolve(this.manager.baseURI, rel);

    return unixpath(result);
  },

  // input filename
  get basename(){
    return this.filename
      ? path.basename(this.filename)
      : '';
  },
  get name(){
    return this.filename
      ? path.basename(this.filename, path.extname(this.filename))
      : '';
  },
  get ext(){
    return this.filename
      ? path.extname(this.filename)
      : '';
  },
  get relpath(){
    return this.filename
      ? unixpath(path.relative(this.manager.baseURI, this.filename))
      : '[inline ' + this.type + ']';
  },

  // input baseURI
  get baseURI(){
    return unixpath(this.filename ? path.dirname(this.filename) + '/' : this.baseURI_ || '');
  },
  set baseURI(uri){
    if (!this.filename)
      this.baseURI_ = unixpath(path.resolve(this.manager.baseURI, uri) + '/');
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

  // links
  link: function(file){
    this.linkTo.add(file);
    file.linkBack.add(this);
  },
  linkFrom: function(file){
    file.link(this);
  },
  unlink: function(file){
    this.linkTo.remove(file);
    file.linkBack.remove(this);
  },

  hasLinkTo: function(file){
    return this.linkTo.indexOf(file) != -1;
  },
  hasLinkFrom: function(file){
    return file.hasLinkTo(this);
  },
  hasLinkType: function(type){
    return this.linkBack.some(function(file){
      return file.type == type;
    });
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

/**
 * @class FileManager
 */

var FileManager = function(baseURI, console){
  this.baseURI = baseURI;
  this.console = console;

  this.map = {};
  this.queue = [];
}

FileManager.prototype = {
  add: function(data){
    var file;

    if (!data.filename)
    {
      file = new File(this, data);
    }
    else
    {
      // ignore references for external resources
      if (isExternal(data.filename))
      {
        // external resource
        this.console.log('[i] External resource `' + data.filename + '` ignored');
        return;
      }

      var filename = abspath(this.baseURI, data.filename);
                     // remove everything after ? (query string) or # (hash)
                     // and normalize

      if (this.map[filename]) // ignore duplicates
      {
        this.console.log('[ ] File `' + unixpath(path.relative(this.baseURI, filename)) + '` already in this.queue');
        return this.map[filename];
      }

      // create file
      data.filename = filename;
      file = new File(this, data);

      // read content
      if (fs.existsSync(filename))
      {
        if (fs.statSync(filename).isFile())
        {
          this.console.log('[+] ' + file.relpath + ' (' + file.type + ')');
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
        this.console.log('[WARN] ' + file.warn);
        file.content = getFileContentOnFailure(filename);
      }

      this.map[filename] = file;
    }

    this.queue.add(file);

    return file;
  },

  get: function(filename){
    var fileId = abspath(this.baseURI, filename);
    console.log(fileId);

    return this.map[fileId];
  },

  remove: function(filenameOrFile){
    var fileId;
    var file;
    
    if (filenameOrFile instanceof File)
    {
      file = filenameOrFile;
      fileId = file.filename;
    }
    else
    {
      fileId = abspath(this.baseURI, filenameOrFile);
      file = this.map[fileId];

      if (!file)
      {
        fconsole.log('[WARN] File `' + filenameOrFile + '` not found in map');
        return;
      }
    }

    // remove links
    for (var i = file.linkTo.length, linkTo; linkTo = file.linkTo[i]; i--)
      file.unlink(linkTo);

    for (var i = file.linkBack.length, linkBack; linkBack = file.linkBack[i]; i--)
      linkBack.unlink(file);

    // remove from queue
    this.queue.remove(file);

    // remove from map
    if (fileId)
      delete this.map[fileId];
  },

  mkdir: function(dirpath){
    if (!fs.existsSync(dirpath))
    {
      this.console.log('Create folder ' + dirpath);
      fs.mkdirSync(dirpath);  
    }
  }
};

//
// export
//

module.exports = FileManager;
