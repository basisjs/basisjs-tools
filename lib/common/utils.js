var path = require('path');
var mime = require('mime');
var utils = require('../utils.js');

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
  return unixpath(path.resolve(baseURI || '', filename));
}


module.exports = {
  repeat: function(str, count){
    return new Array(count + 1).join(str);
  },

  fetchCommit: utils.fetchCommit,
  getToolsId: utils.getToolsId,

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
  }
};
