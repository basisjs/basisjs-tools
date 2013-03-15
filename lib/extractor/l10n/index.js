module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  flow.l10n.packages = [];


  //
  // Add dictionary files
  //

  fconsole.start('Fetch dictionary files');
  for (var path in flow.l10n.pathes)
  {
    fconsole.start(reldir(flow, path));
    for (var i = 0; culture = flow.l10n.cultureList[i]; i++)
    {
      var dictFile = flow.files.add({
        filename: path + '/' + culture + '.json',
        type: 'l10n',
        culture: culture
      });

      flow.l10n.pathes[path].__files.forEach(function(file){
        file.link(dictFile); // ???
      });
    }
    fconsole.endl();
  }
};

module.exports.handlerName = '[l10n] Extract';


//
// Main part
//

var path = require('path');

function reldir(flow, dir){
  return path.relative(flow.options.base, dir).replace(/\\/g, '/') + '/';  // [base]
}