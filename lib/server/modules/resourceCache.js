var logMsg = require('./utils').logMsg;
var chalk = require('chalk');
var hasOwnProperty = Object.prototype.hasOwnProperty;
var invalidate = true;
var cacheFile = {};
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

require('./virtualFile').add('/basisjs-tools/resourceCache.js', function(api){
  var cache = getCacheContent();

  if (api.isContentModified(cache.mtime))
  {
    if (cacheFile.cache !== cache)
    {
      api.logMsg(chalk.yellow('(generate)'));
      cacheFile.cache = cache;
      cacheFile.content = 'window.__resources__ = ' + cache.data;
      cacheFile.zip = {};
    }
    else
    {
      api.logMsg(chalk.green('(from cache)'));
    }

    api.responseToClient(cacheFile.content, {
      contentType: 'application/javascript',
      mtime: cache.mtime,
      file: cacheFile,
      encoding: api.encoding,
      nocache: true
    });
  }
  else
    api.logMsg(chalk.green('304'));
});

module.exports = {
  get: getCacheContent,
  has: function(fnKey){
    return hasOwnProperty.call(cache, fnKey);
  },
  add: function(fnKey, content){
    if (cache[fnKey] !== content)
    {
      logMsg('cache', (fnKey in cache ? 'update ' : 'add ') + fnKey, true);
      cache[fnKey] = content;

      invalidate = true;
    }
  },
  remove: function(fnKey){
    if (fnKey in cache)
    {
      logMsg('cache', 'remove ' + fnKey, true);
      delete cache[fnKey];

      invalidate = true;
    }
  }
};
