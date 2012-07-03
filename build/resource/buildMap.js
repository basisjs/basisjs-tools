
var path = require('path');

module.exports = function(flowData){
  var jsResourceMap = {};

  for (var i = 0, file; file = flowData.files.queue[i]; i++)
  {
    if (file.isResource && file.type != 'style')
    {
      file.jsRef = i + path.extname(file.filename);
      jsResourceMap[file.filename] = file;
    }
  }

  flowData.js.resourceMap = jsResourceMap;
  //console.log(jsResourceMap);
}