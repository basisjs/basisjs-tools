module.exports = function(flow){
  var fconsole = flow.console;
  var jsResourceMap = {};

  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    // file.hasLinkType('script') && (file.type != 'script' || !file.namespace) && (file.type != 'style')
    // todo: merge l10n json
    if (file.isResource)
    {
      if (file.type != 'style')
      {
        fconsole.log(file.relpath, '->', file.jsRef);
        jsResourceMap[file.jsRef] = file;
      }
      else
      {
        file.jsRef = '0.css';
        if (!jsResourceMap[file.jsRef])
          jsResourceMap[file.jsRef] = flow.files.add({
            jsRef: file.jsRef,
            content: ''
          });
      }
    }
  }

  flow.js.resourceMap = jsResourceMap;
};

module.exports.handlerName = '[res] Build map';
