
module.exports = function(flowData){
  flowData.html = {
    removeToken: function(token){
      this.replaceToken(token, { type: 'text', data: '' });
    },
    replaceToken: function(token, cfg){
      for (var key in token)
        if (token.hasOwnProperty(key))
          delete token[key];

      for (var key in cfg)
        token[key] = cfg[key];
    }
  }
}