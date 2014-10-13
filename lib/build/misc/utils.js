var path = require('path');
var fs = require('fs');
var mime = require('mime');

//
// Extend buildin prototypes
//

Array.prototype.add = function(value){
  return this.indexOf(value) == -1 && !!this.push(value);
};
Array.prototype.remove = function(value){
  var pos = this.indexOf(value);

  if (pos != -1)
    this.splice(pos, 1);

  return pos != -1;
};

String.prototype.repeat = function(count){
  var result = [];
  for (var i = 0; i < count; i++)
    result[i] = this;
  return result.join('');
};

//
// Export functions
//

var dataUriRx = /^\s*data:\s*(\S+)\s*;/i;
var base64PrefixRx = /^\s*base64\s*,\s*/i;
var externalUri = /^(\/\/|\S+:)/i;
var hashRx = /#.*$/;

function unixpath(filename){
  return path.normalize(filename).replace(/^[a-z]+:/i, '').replace(/\\/g, '/');
}

function resolveToBase(flow, filename, baseURI){
  filename = unixpath(filename);
  var absFilename = unixpath(path.resolve(baseURI || '', filename));
  if (absFilename == filename)
    absFilename = unixpath(flow.options.base + filename);
  return absFilename;
}

module.exports = {
  unixpath: unixpath,
  resolveToBase: resolveToBase,
  relToIndex: function(flow, filename, baseURI){
    return unixpath(path.relative(path.dirname(flow.options.file), resolveToBase(flow, filename, baseURI)));
  },

 /**
  * Convert some data to data-uri.
  * @param {*} data
  * @param {string} filename
  */
  toDataUri: function(data, filename){
    return 'data:' + mime.lookup(filename) + ';base64,' + new Buffer(data).toString('base64');
  },

 /**
  * Convert resource string to meta-object.
  *   'data:mime/type;content#hash' -> {
  *     mime: 'mime/type',
  *     content: 'content',
  *     hash: '#hash'
  *   }
  *
  *   'data:mime/type;base64,content#hash' -> {
  *     mime: 'mime/type',
  *     content: 'decodedContent',
  *     base64: true,
  *     hash: '#hash'
  *   }
  *
  *   'schema:url#hash' -> {
  *     url: 'schema:url',
  *     hash: '#hash'
  *   }
  *
  *   '//url#hash' -> {
  *     url: '//url',
  *     hash: '#hash'
  *   }
  *
  *   'anythingElse#hash' -> {
  *     filename: 'anythingElse',
  *     hash: '#hash'
  *   }
  *
  * @param {string} uri
  * @return {object}
  */
  resolveUri: function(uri){
    var hash = '';
    uri = uri.trim().replace(hashRx, function(m){
      hash = m;
      return '';
    });

    var m = uri.match(dataUriRx);
    if (m)
    {
      var result = {
        mime: m[1],
        content: uri.replace(dataUriRx, ''),
        hash: hash
      };

      // decode from base64
      if (base64PrefixRx.test(result.content))
      {
        result.base64 = true;
        result.content = new Buffer(result.content.replace(base64PrefixRx, ''), 'base64').toString('utf-8');
      };

      return result;
    }
    else
    {
      if (externalUri.test(uri))
        return {
          url: uri,
          hash: hash
        };
      else
        return {
          filename: uri,
          hash: hash
        };
    }
  },

 /**
  * Trying get a commit hash for specified folder (supposed a git repo or bower library).
  * @param {string} basisDir Location for lookup
  * @param {number=} len Max length of hash
  */
  fetchCommit: function(basisDir, len){
    if (!len)
      len = 10;

    try {
      var gitPath = basisDir + '/.git/';
      var gitRef = fs.readFileSync(gitPath + 'HEAD', 'utf-8');
      if (gitRef)
      {
        var ref = gitRef.match(/(?:^|\n)ref:\s*([^\n]+)/);
        if (ref)
          return fs.readFileSync(gitPath + ref[1], 'utf-8').substr(0, len);
      }
    } catch(e) {}

    try {
      return require(basisDir + '/.bower.json')._resolution.commit.substr(0, len);
    } catch(e){}
  }
};
