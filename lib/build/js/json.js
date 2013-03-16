
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
  if (file.jsResourceContent)
  {
    flow.console.log('[ ] already parsed');
    return;
  }

  try {
    file.jsResourceContent = JSON.parse(file.content);
    flow.console.log('[OK] parsed');
  } catch(e) {
    flow.warn({
      file: file.relpath,
      message: 'JSON parse error: ' + (e.message || e)
    });
  }
}