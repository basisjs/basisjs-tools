
module.exports = function(flowData){

  flowData.files.addNotFoundHandler('.css', function(filename){
    return '/* CSS file ' + filename + ' not found */';
  });

  var genericStyleFile = flowData.files.add({
    outputFilename: '_generic',
    source: 'generic',
    type: 'style',
    baseURI: flowData.baseURI,
    content: ''
  });

  flowData.css = {
    outputFiles: [],
    genericFile: genericStyleFile
  };

};