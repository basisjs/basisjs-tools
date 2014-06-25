var logMsg = require('./utils').logMsg;
var invalidate = false;
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

rebuild();

module.exports = {
  has: function(fnKey){
    return cache.hasOwnProperty(fnKey);
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
  },
  get: function(){
    if (invalidate)
    {
      invalidate = false;
      rebuild();
    }

    return content;
  }
};
