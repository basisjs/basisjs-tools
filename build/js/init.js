
module.exports = function(flowData){

  flowData.files.addNotFoundHandler('.js', function(filename){
    return '/* Javascript file ' + filename + ' not found */';
  });

  flowData.js = {
    rootBaseURI: {},
    getFileContext: function(file){
      return {
        __filename: file.filename || '',
        __dirname: file.baseURI,
        namespace: file.namespace || ''
      };
    }
  };

};
