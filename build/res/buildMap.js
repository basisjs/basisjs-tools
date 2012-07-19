
module.exports = function(flowData){
  var jsResourceMap = {};

  for (var i = 0, file; file = flowData.files.queue[i]; i++)
  {
    if (file.isResource)
    {
      if (file.type != 'style')
      {
        if (!file.jsRef)
          file.jsRef = i.toString(36) + file.ext;

        jsResourceMap[file.jsRef] = file;
      }
      else
      {
        file.jsRef = '0.css';
        if (!jsResourceMap[file.jsRef])
          jsResourceMap[file.jsRef] = flowData.files.add({
            jsRef: '0.css',
            content: ''
          });
      }
    }
  }

  flowData.js.resourceMap = jsResourceMap;
  //console.log(jsResourceMap);
}

module.exports.handlerName = '[res] Build map';