var path = require('path');
var Minimatch = require('minimatch').Minimatch;
var mime = require('mime');
var chalk = require('chalk');
var files = require('./files');
var virtualFile = require('./virtualFile');
var utils = require('./utils');
var logWarn = utils.logWarn;
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

  return {
    addVirtualFile: function(filename, content){
      var filename =
        '/basisjs-tools/plugin:' +
        path.basename(path.dirname(pluginOptions.name).replace(/^\.$/, '') || pluginOptions.name) +
        path.resolve('/' + filename);
      var contentType = mime.lookup(filename, 'text/plain');
      var file = {
        content: content,
        zip: {}
      };

      virtualFile.add(filename, function(api){
        api.logMsg(chalk.green('(from cache)'));
        api.responseToClient(content, {
          contentType: contentType,
          encoding: api.encoding,
          file: file
        });
      });

      return filename;
    },
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

        fn(content, '/' + relFilename, function(err, newContent){
          if (err) {
            logWarn('plugin', '[' + pluginOptions.name + '] ' + err);
            newContent = content;
          }

          cb(null, newContent);
        });
      });
    }
  };
};
