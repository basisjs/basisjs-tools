
module.exports = function(flowData){

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

module.exports.handlerName = '[js] Init';