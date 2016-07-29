var logMsg = require('./utils').logMsg;
var chalk = require('chalk');
var hasOwnProperty = Object.prototype.hasOwnProperty;
var invalidate = true;
var cacheFile = { zip: {} };
var cache = {};
var content;

// function contentDigest(content){
//   var hash = require('crypto').createHash('md5');
//   hash.update(content);
//   return hash.digest('base64')
//     // remove trailing == which always appear on md5 digest, save 2 bytes
//     .replace(/=+$/, '')
//     // make digest web safe
//     .replace(/\//g, '_')
//     .replace(/\+/g, '-');
// }

function rebuild(){
  if (content)
    logMsg('cache', 'rebuild', true);

  content = {
    mtime: new Date,
    data: JSON.stringify(cache, null, 2)
  };
  //content.digest = contentDigest(raw);
}

function getCacheContent(){
  if (invalidate)
  {
    invalidate = false;
    rebuild();
  }

  return content;
}

require('./http/virtualPath').add('/basisjs-tools/resourceCache.js', function(api){
  var cache = getCacheContent();

  if (api.isContentModified(cache.mtime))
  {
    if (cacheFile.cache !== cache)
    {
      cacheFile.cache = cache;
      cacheFile.content = 'window.__resources__ = ' + cache.data;
      cacheFile.zip = {};
    }

    api.responseToClient(cacheFile.content, {
      contentType: 'application/javascript',
      mtime: cache.mtime,
      file: cacheFile,
      encoding: api.encoding,
      nocache: true
    }, cacheFile.cache !== cache ? chalk.yellow('(generate)') : chalk.green('(from cache)'));
  }
});

module.exports = {
  get: getCacheContent,
  has: function(key){
    return hasOwnProperty.call(cache, key);
  },
  add: function(key, content){
    if (cache[key] !== content)
    {
      logMsg('cache', key + ' ' + (key in cache ? chalk.yellow('(update)') : chalk.green('(add)')), true);
      cache[key] = content;

      invalidate = true;
    }
  },
  remove: function(key){
    if (key in cache)
    {
      logMsg('cache', key + ' ' + chalk.red('(drop)'), true);
      delete cache[key];

      invalidate = true;
    }
  }
};
