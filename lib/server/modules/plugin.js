var path = require('path');
var Minimatch = require('minimatch').Minimatch;
var chalk = require('chalk');
var files = require('./files');
var utils = require('./utils');
var basisjsToolsPath = path.resolve(__dirname, '../../..');
var extensions = [];

function createPluginApi(name, options, pluginOptions){
  var ignore;

  if (Array.isArray(pluginOptions.ignore))
    ignore = pluginOptions.ignore.map(function(fileMask){
      return new Minimatch(fileMask, { dot: true });
    });

  var api = {
    log: function(msg, verboseOnly){
      utils.logMsg('plugin', chalk.yellow(name) + ': ' + msg, verboseOnly);
    },
    warn: function(msg){
      utils.logWarn('plugin', chalk.yellow(name) + ': ' + msg);
    },
    error: function(msg){
      utils.logError('plugin', chalk.yellow(name) + ': ' + msg);
    },
    absolutePath: files.absolutePath,
    relativePath: files.relativePath,
    addPreprocessor: function(ext, fn){
      function preprocessorWrapper(content, filename, cb){
        var relFilename = files.relativePath(filename);
        var shouldIgnore = ignore && ignore.some(function(minimatch){
          return minimatch.match(filename);
        });

        // ignore files outside options.base location and basisjs-tools files
        if (shouldIgnore ||
            path.normalize(filename).indexOf(basisjsToolsPath) == 0)
        {
          utils.logMsg('plugin', chalk.yellow(name) + ' (' + chalk.yellow(fn.name || '<anonymous-preprocessor>') + ') ignore ' + relFilename, true);
          return cb(null, content);
        }

        fn(content, relFilename, function(err, newContent){
          if (err)
          {
            utils.logError('plugin', chalk.yellow(name) + ': ' + err);
            newContent = content;
          }

          cb(null, newContent);
        });
      };

      preprocessorWrapper.propercessorName = fn.name;
      files.addPreprocessor(ext, preprocessorWrapper);
    }
  };

  extensions.forEach(function(extension){
    extension.call(null, api, name);
  });

  return api;
};

module.exports = {
  extendApi: function(extension){
    extensions.push(extension);
  },
  init: function(pluginCfg, options){
    var initPlugin = require(pluginCfg.filename);

    if (typeof initPlugin.server == 'function')
      initPlugin = initPlugin.server;

    initPlugin(
      createPluginApi(pluginCfg.name, options, pluginCfg),
      pluginCfg.options || {},
      Object.create(options)
    );
  }
};
