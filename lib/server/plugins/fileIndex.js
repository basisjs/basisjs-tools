var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var files = require('../modules/files');

module.exports = function(api, config, options){
  function readdir(dirname){
    if (options.ignore.indexOf(path.normalize(dirname)) != -1 &&
        path.basename(filename).charAt(0) != '.')
      return;

    var list = fs.readdirSync(dirname);
    for (var i = 0, filename; filename = list[i]; i++)
    {
      var fullPath = path.join(dirname, filename);
      var stat = fs.statSync(fullPath);

      if (stat.isDirectory())
        readdir(fullPath);
      else
      {
        if (hotStartExtensions.indexOf(path.extname(fullPath)) != -1)
        {
          api.log('    ' + files.relativePath(fullPath));
          files.addToCache(fullPath, fs.readFileSync(fullPath, 'utf8'));
        }
      }
    }
  }

  var hotStartExtensions = ['.css', '.tmpl', '.json', '.js', '.l10n'];

  api.log('Build index');
  api.log('  Path: ' + options.index);
  if (options.ignore && options.ignore.length)
    api.log('Ignore paths:\n  ' + chalk.green(options.ignore.map(files.relativePath).join('\n  ')) + '\n');

  api.log('  Files:');
  readdir(options.index);

  api.log('  DONE');
};
