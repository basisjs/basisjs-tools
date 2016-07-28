var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var exit = require('exit');
var createHttpServer = require('./modules/http-server');
var createWsServer = require('./modules/ws-server').create;
var initPlugin = require('./modules/plugin');
var utils = require('./modules/utils');
var files = require('./modules/files');
var command = require('./command');


//
// launched by another module
//
exports.launch = function(config){
  if (this === command)
    launch(config);

  if (this === exports)
    launch(command.normalize(config));
};


//
// launched directly (i.e. node index.js ..)
//
if (process.mainModule === module)
  command.run();


//
// main function
//
function launch(config){
  var options = command.norm(config);

  utils.verbose = options.verbose;
  chalk.enabled = options.color && process.stdout.isTTY;
  files.setBase(options.base);

  // imports
  var logMsg = utils.logMsg;
  var logWarn = utils.logWarn;
  var fsWatcher = { // stab fsWatcher
    awaitFile: function(){},
    startWatch: function(){},
    stopWatch: function(){},
    isFileObserve: function(){}
  };

  // settings
  var ignorePaths = options.ignore;
  var rewriteRequest = function(location){
    return location;
  };

  // check base path
  if (!fs.existsSync(options.base))
  {
    console.error('Base path `' + options.base + '` not found');
    exit(2);
  }

  if (options.rewrite)
    rewriteRequest = require('./modules/rewrite').create(options.rewrite);

  [
    './plugins/openFile.js'
  ].map(function(pluginPath){
    initPlugin({
      filename: path.join(__dirname, pluginPath),
      name: path.basename(pluginPath, path.extname(pluginPath))
    },
    options);
  });

  // init plugins
  options.plugins.forEach(function(pluginCfg, index, array){
    try {
      initPlugin(pluginCfg, options);
    } catch(e) {
      logWarn('plugin', e.message);
      exit(2);
    }

    console.log('Plugin ' + chalk.yellow(pluginCfg.name) + ' loaded');

    // blank line after last item list
    if (index == array.length - 1)
      console.log('');
  });

  // banner
  if (options.verbose)
  {
    console.log('Base path: ' + chalk.green(options.base));
    console.log('Watching for FS: ' + chalk.green(options.sync ? 'YES' : 'NO'));

    if (options.editor)
      console.log('Command to open file in editor: ' + chalk.green(options.editor + ' [filename]'));

    if (ignorePaths && ignorePaths.length)
      console.log('Ignore paths:\n  ' + chalk.green(ignorePaths.map(files.relativePath).join('\n  ')) + '\n');

    if (options.plugins.length)
      console.log('Plugins:\n  ' + options.plugins.map(function(pluginCfg){
        return chalk.green(pluginCfg.name) + ' → ' + chalk.gray(path.relative(process.cwd(), pluginCfg.filename_).replace(/\\/g, '/'));
      }).join('\n  '));

    var rewriteRules = Object.keys(rewriteRequest.rules || {}).sort().map(function(pathMask){
      var rules = rewriteRequest.rules[pathMask];

      if (!rules.length)
        return;

      return '  ' + chalk.cyan(pathMask) + '\n    ' + rules.map(function(rule){
        return chalk.green(rule.re.toString()) + ' → ' + chalk.green(rule.url);
      });
    }).filter(Boolean).join('\n\n');

    if (rewriteRules)
      console.log('Rewrite rules:\n' + rewriteRules);

    console.log();
  }

  if (options.index)
    (function(){
      function readdir(dirname){
        if (ignorePaths.indexOf(path.normalize(dirname)) != -1 &&
            path.basename(filename).charAt(0) != '.')
          return;

        var list = fs.readdirSync(dirname);
        for (var i = 0, filename; filename = list[i]; i++)
        {
          filename = dirname + '/' + filename;

          var stat = fs.statSync(filename);
          if (stat.isDirectory())
            readdir(filename);
          else
          {
            if (hotStartExtensions.indexOf(path.extname(filename)) != -1)
              files.addToCache(filename, fs.readFileSync(filename, 'utf8'));
          }
        }
      }

      console.log('Build index');
      console.log('  Path: ' + options.index);

      var hotStartExtensions = ['.css', '.tmpl', '.json', '.js', '.l10n'];
      readdir(options.index);

      console.log('  DONE');
    })();


  //
  // files
  //

  if (options.sync)
    fsWatcher = require('./modules/watch').setBase(options.base);

  files.onAdd(function(filename){
    logMsg('info', files.relativePath(filename) + ' ' + chalk.green('(add)'), true);
  });
  files.onRemove(function(filename){
    var file = files.get(filename);

    logMsg('info', files.relativePath(filename) + ' ' + chalk.red('(drop)'), true);

    fsWatcher.stopWatch(filename);
    if (file.notify)
      fsWatcher.awaitFile(filename);
  });
  files.onRead(function(err, filename, content){
    var file = files.get(filename);
    var relFilename = files.relativePath(filename);

    if (err)
      return logMsg('fs', 'Error: Can\'t read file ' + filename + ': ' + err);

    if (file.content !== content)
    {
      logMsg('info', relFilename + ' ' + chalk.yellow('(update content: ' + content.length + ' bytes)'), true);

      file.zip = {};
      fsWatcher.startWatch(filename);
    }
  });


  //
  // create server
  //

  var httpServer = createHttpServer(options, rewriteRequest, fsWatcher);

  httpServer.listen(options.port, function(){
    var port = this.address().port;

    console.log('Server run at ' + chalk.green('http://localhost:' + port) + '\n');
  });


  //
  // Messaging and fs sync
  //

  if (options.sync)
    require('./modules/file-sync')(createWsServer(httpServer), options);
}
