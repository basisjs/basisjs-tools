
module.exports = function(flowData){

  flowData.css = {
    outputFiles: [],
    classNameMap: {},
    urlTokens: [],
    genericFile: flowData.files.add({
      source: 'generic',
      type: 'style',
      baseURI: flowData.inputDir,
      media: 'all',
      content: ''
    })
  };

};

module.exports.handlerName = '[css] Init';