
var at = require('../../ast').html;

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      if (!file.outputFilename)
        file.outputFilename = file.basename;

      fconsole.log(file.relpath + ' -> ' + file.outputFilename);

      // add build <meta> to index file
      if (file.isIndexFile)
      {
        var buildLabel = getBuildLabel();

        fconsole.log('  * Inject build label to page head: <meta name="build" content"' + buildLabel + '">');
        at.injectToHead(file.ast, {
          type: 'tag',
          name: 'meta',
          attribs: {
            name: 'build',
            content: buildLabel
          },
          children: []
        }, true);
      }

      file.outputContent = at.translate(file.ast);
    }
  }
}

module.exports.handlerName = '[html] Translate';

function getBuildLabel(){
  var date = new Date();

  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()    
  ].map(function(val){
    return val < 10 ? '0' + val : val;
  }).join('');
}
