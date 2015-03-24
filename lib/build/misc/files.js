var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var externalRx = /^(\s*[a-z0-9\-]+:)?\/\//i;
var absRx = /^\s*\//;
var queryAndHashRx = /[\?\#].*$/;
var slashRx = /\\/g;

var textFileExt = ['.css', '.js', '.json', '.tmpl', '.txt', '.svg', '.html'];
var textType = ['script', 'style', 'template', 'json', 'l10n', 'xml', 'svg', 'text'];

var typeByExt = {
  '.js': 'script',
  '.css': 'style',
  '.tmpl': 'template',
  '.html': 'html',
  '.json': 'json',
  '.l10n': 'json',
  '.xml': 'xml',
  '.svg': 'svg',
  '.cur': 'image',
  '.ico': 'image',
  '.bmp': 'image',
  '.gif': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.tiff': 'image',
  '.ttf': 'font',
  '.woff': 'font',
  '.eot': 'font'
};

var typeNotFoundHandler = {
  '.js': '/* Javascript file {filename} not found */',
  '.css': '/* CSS file {filename} not found */'
};

function getFileContentOnFailure(filename){
  return (typeNotFoundHandler[path.extname(filename)] || '').replace(/\{filename\}/, filename);
}

function unixpath(filename){
  return path.normalize(filename).replace(slashRx, '/').replace(/^[a-z]\:/i, '');
}

function abspath(baseURI, filename){
  return unixpath(path.resolve(baseURI, filename.replace(queryAndHashRx, '')).replace(/^[a-z]\:/i, ''));
}

function isExternal(uri){
  return externalRx.test(uri);
}

function getRef(seed, type){
  seed[type] = (type in seed ? seed[type] : -1) + 1;
  return seed[type].toString(36) + type;
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
    this.type = manager.typeByExt[this.ext] || typeByExt[this.ext] || 'unknown';

  if (!this.filename)
  {
    var type = (this.generated ? 'generated-' : '') + this.type;
    manager.inline[type] = (manager.inline[type] || 0) + 1;
    this.inlineId = '[' + (this.inline ? 'inline ' : '') + type + '#' + manager.inline[type] + ']';
  }
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
  get dirname(){
    return this.filename
      ? path.dirname(this.filename)
      : '';
  },
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
      : this.sourceFilename || this.inlineId;
  },
  get reldir(){
    return this.filename
      ? path.dirname(this.relpath)
      : this.sourceFilename || this.inlineId;
  },
  get fsFilename(){
    return this.filename
      ? this.manager.getFSFilename(this.filename)
      : this.sourceFilename || this.inlineId;
  },

  // input baseURI
  get baseURI(){
    if (!this.baseURI_)
      this.baseURI_ = unixpath(this.filename ? path.dirname(this.filename) + '/' : '');
    return this.baseURI_;
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
    this.inline = false;
  },
  get relOutputFilename(){
    return this.outputFilename || ('outputContent' in this ? this.inlineId : '[no output]');
  },

  // refs
  get jsRef(){
    if (!this.jsRef_)
      this.jsRef_ = this.manager.getRef(this.ext);
    return this.jsRef_;
  },
  set jsRef(ref){
    this.jsRef_ = ref;
  },

  // links
  link: function(file, token){
    var link = [file, token];
    token = token || null;

    this.linkTo.add(link);
    this.manager.links.push([this, file]);
    file.linkBack.add([this, token]);

    if (token)
    {
      if (!token.links)
        token.links = [];
      token.links.push(link);

      if (file.warn)
      {
        var loc = token.loc || '';
        this.manager.flow.removeWarn(file.warn);
        this.manager.flow.warn({
          fatal: true,
          loc: loc,
          file: this.relpath || loc.replace(/:\d+:\d+$/, ''),
          message: file.warn.message
        });
      }
    }
  },
  linkFrom: function(file){
    file.link(this);
  },
  unlink: function(file, token){
    token = token || null;

    for (var i = this.linkTo.length - 1; i >= 0; i--)
    {
      var link = this.linkTo[i];
      if (link[0] === file && link[1] === token)
        this.linkTo.splice(i, 1);
    }

    for (var i = this.linkBack.length - 1; i >= 0; i--)
    {
      var link = this.linkBack[i];
      if (link[0] === file && link[1] === token)
        this.linkBack.splice(i, 1);
    }
  },

  hasLinkTo: function(file){
    return this.linkTo.some(function(link){
      return link[0] == file;
    });
  },
  hasLinkFrom: function(file){
    return file.hasLinkTo(this);
  },
  hasLinkType: function(type){
    return this.linkBack.some(function(link){
      return link[0].type == type;
    });
  },

  // misc
  get digest(){
    if (!this.digest_)
    {
      var hash = crypto.createHash('md5');
      hash.update(this.outputContent || this.content || '');
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
    return textType.indexOf(this.type) == -1 && textFileExt.indexOf(this.ext) == -1 ? 'binary' : 'utf-8';
  }
};

/**
 * @class FileManager
 */

var FileManager = function(baseURI, relBaseURI, console, flow){
  this.baseURI = abspath('/', relBaseURI);
  this.fsBaseURI = baseURI;
  this.console = console;
  this.preprocess = {};
  this.typeByExt = {};
  this.refSeed = {};
  this.inline = {};
  this.flow = flow;

  this.map = {};
  this.queue = [];
  this.links = [];
  this.warns = [];

  this.readInfo = [];
};

FileManager.prototype = {
  resolve: function(filename, baseURI){
    return abspath(abspath(baseURI || '.', this.baseURI), filename);
  },

  relative: function(filename){
    return abspath('/', path.relative(this.fsBaseURI, filename));
  },

 /**
  * Returns absolute filesystem filename.
  * @param {string} filename
  * @return {string}
  */
  getFSFilename: function(filename){
    return path.resolve(this.fsBaseURI, filename.replace(/^[\\\/]/, ''));
  },

 /**
  * Generate reference for ext.
  * @param {string} ext
  * @return {string}
  */
  getRef: function(ext){
    return getRef(this.refSeed, ext || '.inline');
  },

 /**
  * Get reference for File by filename.
  * @param {string} filename Path to file.
  * @returns {File} Returns file if exists.
  */
  get: function(filename){
    return this.map[abspath(this.baseURI, filename)];
  },

  read: function(filename){
    filename = abspath(this.baseURI, filename);

    var fsFilename = this.getFSFilename(filename);
    var file = this.map[filename];
    var content = '';

    if (file)
      return file.content;

    if (fs.existsSync(fsFilename) && fs.statSync(fsFilename).isFile())
    {
      file = new File(this, { filename: filename });
      content = fs.readFileSync(fsFilename, file.encoding);

      // collect data to produce content digest
      this.readInfo.push({
        filename: filename,
        encoding: file.encoding,
        content: content
      });

      // preprocessing by extension
      var preprocessors = this.preprocess[file.ext] || [];
      for (var i = 0, processor; processor = preprocessors[i]; i++)
        content = processor(content, file, this.fsBaseURI, this.console);

      // preprocessing by type
      var preprocessors = this.preprocess[file.type] || [];
      for (var i = 0, processor; processor = preprocessors[i]; i++)
        content = processor(content, file, this.fsBaseURI, this.console);
    }
    else
    {
      if (this.contextFile_)
      {
        var warn = {
          fatal: true,
          file: this.contextFile_,
          message: fs.existsSync(fsFilename)
            ? '`' + filename + '` is not a file (' + fsFilename + ')'
            : 'File `' + filename + '` not found (' + fsFilename + ')'
        };
        this.warns.push(warn);
        this.flow.warn(warn);
      }
    }

    return content;
  },

 /**
  * Create new file or return existing. It can returns undefined if filename is external reference.
  * @param {object} data Config object to create new file.
  * @return {File|undefined}
  *
  * TODO: extend file with ?, if it already exists
  * TODO: create file with uri, if it's external?
  */
  add: function(data){
    var file;

    if (!data.filename)
    {
      file = new File(this, data);
      this.console.log('[+] ' + file.relpath + ' (' + file.type + (file.generatedFrom ? ', source: ' + file.generatedFrom : '') + ')');
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

      var rawFilename = data.filename;
      var filename = abspath(this.baseURI, data.filename);
                     // remove everything after ? (query string) or # (hash)
                     // and normalize

      if (this.map[filename]) // ignore duplicates
      {
        this.console.log('[ ] ' + unixpath(path.relative(this.baseURI, filename)) + ' (already in queue)');
        return this.map[filename];
      }

      // create file
      data.filename = filename;
      file = new File(this, data);

      // read content
      var fsFilename = this.getFSFilename(filename);
      if (fs.existsSync(fsFilename))
      {
        if (fs.statSync(fsFilename).isFile())
        {
          this.console.start('[+] ' + file.relpath + ' (' + file.type + ')');

          file.content = this.read(filename);

          this.console.end();
        }
        else
        {
          file.warn = '`' + file.relpath + '` is not a file (' + filename + ')';
        }
      }
      else
      {
        file.warn = 'File `' + file.relpath + '` not found (' + filename + ')';
      }


      if (file.warn)
      {
        file.warn = {
          fatal: true,
          file: file.relpath,
          message: file.warn
        };
        this.warns.push(file.warn);
        this.flow.warn(file.warn);
        file.content = getFileContentOnFailure(filename);
      }

      this.map[filename] = file;
    }

    this.queue.add(file);

    return file;
  },

 /**
  * Remove a file from manager and break all links between files.
  * @param {File|string} fileRef File name or File instance to be removed.
  */
  remove: function(fileRef){
    var filename;
    var file;

    if (fileRef instanceof File)
    {
      file = fileRef;
      filename = file.filename;
    }
    else
    {
      filename = abspath(this.baseURI, fileRef);
      file = this.map[filename];

      if (!file)
      {
        this.flow.warn({
          file: filename,
          message: 'File `' + fileRef + '` not found in map'
        });
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
    if (filename)
      delete this.map[filename];
  },

 /**
  * Remove all files
  */
  clear: function(){
    this.queue.slice().forEach(function(file){
      this.remove(file);
    }, this);
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
