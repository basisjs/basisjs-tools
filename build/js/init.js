
module.exports = function(flowData){

  flowData.files.addNotFoundHandler('.js', function(filename){
    return '/* Javascript file ' + filename + ' not found */';
  });

  flowData.js = {
    base: {}
  };

};
