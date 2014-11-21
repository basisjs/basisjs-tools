(module.exports = function(flow){
  var fileTypeMap = {};
  var fconsole = flow.console;

  flow.files.queue.forEach(function(file){
    fileTypeMap[file.type] = (fileTypeMap[file.type] || 0) + 1;
  }, fileTypeMap);

  fconsole.start('File queue:');
  for (var key in fileTypeMap)
    fconsole.log(key + ': ' + fileTypeMap[key]);
  fconsole.endl();
}).handlerName = 'File statistic';
