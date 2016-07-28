var path = require('path');
var Minimatch = require('minimatch').Minimatch;
var mime = require('mime');
var chalk = require('chalk');
var files = require('./files');
var virtualPath = require('./virtualPath');
var ws = require('./ws-server');
var utils = require('./utils');
var basisjsToolsPath = path.resolve(__dirname, '../../..');

function normalizeFilename(filename){
  return path.resolve('/' + filename)
    // windows issues: cut drive in beginning and replaces `\` to `/`
    .replace(/^[a-z]:/i, '')
    .replace(/\\/g, '/');
}

function createPluginApi(name, options, pluginOptions){
  var ignore;

  if (Array.isArray(pluginOptions.ignore))
    ignore = pluginOptions.ignore.map(function(fileMask){
      return new Minimatch(fileMask, { dot: true });
    });

  return {
    absolutePath: files.absolutePath,
    relativePath: files.relativePath,
    log: function(msg, verboseOnly){
      utils.logMsg('plugin', chalk.yellow(name) + ': ' + msg, verboseOnly);
    },
    warn: function(msg){
      utils.logWarn('plugin', chalk.yellow(name) + ': ' + msg);
    },
    error: function(msg){
      utils.logError('plugin', chalk.yellow(name) + ': ' + msg);
    },
    addVirtualFile: function(filename, content){
      var filename =
        '/basisjs-tools/plugin:' +
        path.basename(path.dirname(name).replace(/^\.$/, '') || name) +
        normalizeFilename(filename);
      var contentType = mime.lookup(filename, 'text/plain');
      var file = {
        content: content,
        zip: {}
      };

      virtualPath.add(filename, function(api){
        api.log(chalk.green('(from cache)'));
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
            utils.logWarn('plugin', chalk.yellow(name) + ': ' + err);
            newContent = content;
          }

          cb(null, newContent);
        });
      });
    },
    addSocketCommand: function(name, fn){
      ws.addCommand(name, fn);
    }
  };
};

module.exports = function(pluginCfg, options){
  var initPlugin = require(pluginCfg.filename);

  if (typeof initPlugin.server == 'function')
    initPlugin = initPlugin.server;

  initPlugin(
    createPluginApi(pluginCfg.name, options, pluginCfg),
    pluginCfg.options || {},
    Object.create(options)
  );
};
