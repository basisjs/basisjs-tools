'use strict';

var host = (function(){
  var _g1;

  return {
    fn1: function(module){
    
      var y =  globalFn();

      module.exports = {
        y: _g1 = y
      };


    },
    fn2: function(){
      _g1.call();
    }
  }

})();