var path = require('path');
var files = require('./files');
var Minimatch = require('minimatch').Minimatch;
var basisjsToolsPath = path.resolve(__dirname, '../../..');

function extend(dest, source){
  for (var key in source)
    if (Object.prototype.hasOwnProperty.call(source, key))
      dest[key] = source[key];

  return dest;
}

module.exports = function(options, pluginOptions){
  var ignore;

  if (Array.isArray(pluginOptions.ignore))
    ignore = pluginOptions.ignore.map(function(fileMask){
      return new Minimatch(fileMask, { dot: true });
    });

  return extend({
    addPreprocessor: function(ext, fn){
      files.addPreprocessor(ext, function(content, filename, cb){
        var relFilename = path.relative(options.base || '', filename).replace(/\\/g, '/');
        var shouldIgnore = ignore && ignore.some(function(minimatch){
          return minimatch.match(filename);
        });

        // ignore files outside options.base location and basisjs-tools files
        if (shouldIgnore ||
            /^\.\./.test(relFilename) ||
            path.normalize(filename).indexOf(basisjsToolsPath) == 0)
          return cb(null, content);

        fn(content, '/' + relFilename, cb);
      });
    }
  }, require('basisjs-tools-ast'));
};
