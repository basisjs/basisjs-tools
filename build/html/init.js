
module.exports = function(flowData){
  flowData.html = {
    replaceToken: function(token, cfg){
      for (var key in token)
        if (token.hasOwnProperty(key))
          delete token[key];

      for (var key in cfg)
        token[key] = cfg[key];
    }
  }
}