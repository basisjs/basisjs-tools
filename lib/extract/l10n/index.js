var path = require('path');
var fs = require('fs');

function rel(flow, pathname){
  return path.relative(flow.options.base, pathname).replace(/\\/g, '/');
}

(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  fconsole.start('Fetch dictionary files');

  if (flow.l10n.version == 2)
  {
    
  }
  else
  {
    for (var dir in flow.l10n.pathes)
    {
      fconsole.start(rel(flow, dir) + '/');
      for (var i = 0; culture = flow.l10n.cultureList[i]; i++)
      {
        var filename = dir + '/' + culture + '.json';
        if (fs.existsSync(filename))
        {
          var dictFile = flow.files.add({
            filename: filename,
            type: 'l10n',
            culture: culture
          });

          flow.l10n.pathes[dir].__files.forEach(function(file){
            file.link(dictFile); // ???
          });
        }
        else
        {
          flow.warn({
            message: 'Dictionary file ' + rel(flow, filename) + ' not found'
          });
        }
      }
      fconsole.endl();
    }
  }

}).handlerName = '[l10n] Extract';
