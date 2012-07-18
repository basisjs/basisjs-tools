

module.exports = {
  getText: function(node){
    return (node.children && node.children[0] && node.children[0].data) || '';
  },
  getAttrs: function(node){
    return node.attribs || {};
  },

  injectToHead: function(ast, node){
    var insertPoint = ast;

    if (ast.head)
      insertPoint = ast.head.children || (ast.head.children = []);

    insertPoint.push(node);
  },
  injectToBody: function(ast, node){
    var insertPoint = ast;

    if (ast.body)
      insertPoint = ast.body.children || (ast.body.children = []);

    insertPoint.push(node);
  },


  walk: function(ast, handler){
    function walkNode(nodes){
      for (var i = 0, node; node = nodes[i]; i++)
      {
        handler(node);

        if (node.children)
          walkNode(node.children);
      }
    }

    walkNode(ast);
  },

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
};