
module.exports = function(flowData){

  flowData.files.addNotFoundHandler('.css', function(filename){
    return '/* CSS file ' + filename + ' not found */';
  });

  var genericStyleFile = flowData.files.add({
    source: 'generic',
    type: 'style',
    baseURI: flowData.inputDir,
    media: 'all',
    content: ''
  });

  flowData.css = {
    outputFiles: [],
    classNameMap: {},
    urlTokens: [],
    genericFile: genericStyleFile
  };

};

module.exports.handlerName = '[css] Init';