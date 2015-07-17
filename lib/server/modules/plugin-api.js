var path = require('path');
var files = require('./files');

function extend(dest, source){
  for (var key in source)
    if (Object.prototype.hasOwnProperty.call(source, key))
      dest[key] = source[key];

  return dest;
}

module.exports = function(options){
  return extend({
    addPreprocessor: function(ext, fn){
      files.addPreprocessor(ext, function(content, filename, cb){
        var filename = path.relative(options.base || '', filename).replace(/\\/g, '/');

        if (/^..\//.test(filename))
          return cb(null, content);

        fn(content, '/' + filename, cb);
      });
    }
  }, require('../../ast'));
};
