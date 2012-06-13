
module.exports = function(flowData){

  flowData.files.addNotFoundHandler('.css', function(filename){
    return '/* CSS file ' + filename + ' not found */';
  });


  flowData.css = {
    outputFiles: [],
    genericFile: {
      outputFilename: '_generic',
      source: 'generic',
      type: 'style',
      baseURI: flowData.baseURI,
      content: ''
    }
  };

};