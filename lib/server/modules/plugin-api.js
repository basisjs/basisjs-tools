var path = require('path');
var files = require('./files');
var basisjsToolsPath = path.resolve(__dirname, '../../..');

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
        var relFilename = path.relative(options.base || '', filename).replace(/\\/g, '/');

        // ignore files outside options.base location and basisjs-tools files
        if (/^\.\./.test(relFilename) ||
            path.normalize(filename).indexOf(basisjsToolsPath) == 0)
          return cb(null, content);

        fn(content, '/' + relFilename, cb);
      });
    }
  }, require('../../ast'));
};
