
module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  fconsole.start('Process json');
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'json')
    {
      fconsole.start(file.relpath);

      processFile(file, flow);

      fconsole.endl();
    }
  fconsole.endl();
}

module.exports.handlerName = '[json] Parse';

function processFile(file, flow){
  var obj = {};
  try {
    file.jsResourceContent = JSON.parse(file.content);
  } catch(e) {
    flow.console.log('[ERROR] can\'t parse', file.relpath);
  }
}