var htmlparser = require('htmlparser2');

var parserConfig = {
  lowerCaseTags: true
};

module.exports = {
  parse: function(html){
    // prepare parser
    var handler = new htmlparser.DomHandler(false, {
      refParent: true
    });
    var parser = new htmlparser.Parser(handler, parserConfig);

    // parse html
    parser.parseComplete(html);

    this.walk(handler.dom, {
      '*': function(node){
        if (node.type == 'style' || node.type == 'script')
          node.type = 'tag';
      }
    });

    return handler.dom;
  },
  translate: function(ast){
    return htmlparser.DomUtils.getInnerHTML({
      children: Array.isArray(ast) ? ast : [ast]
    });
  },

  getText: function getText(node){
    var result = '';

    if (node.children)
      result = node.children.reduce(function(res, node){
        return res + (node.type == 'text' ? node.data : getText(node));
      }, '');

    return result;
  },
  getAttrs: function(node){
    return node.attribs || {};
  },
  rel: function(node, entry){
    var rels = (this.getAttrs(node).rel || '').trim().split(/\s+/);

    return entry
      ? rels.indexOf(entry) != -1
      : rels;
  },

  injectToHead: function(ast, node, begin){
    var insertPoint = ast;

    if (ast.head)
      insertPoint = ast.head.children || (ast.head.children = []);

    if (begin)
      insertPoint.unshift(node);
    else
      insertPoint.push(node);
  },
  injectToBody: function(ast, node){
    var insertPoint = ast;

    if (ast.body)
      insertPoint = ast.body.children || (ast.body.children = []);

    insertPoint.push(node);
  },

  walk: function(ast, handlers, context){
    function walkNode(nodes){
      for (var i = 0, node; node = nodes[i]; i++)
      {
        var type = node.type;

        if (typeof handlers[type] == 'function')
          handlers[type].call(context, node);

        if (typeof handlers['*'] == 'function')
          handlers['*'].call(context, node);

        if (node.children)
          walkNode(node.children);
      }
    }

    walkNode(ast);
  },

  removeToken: function(token, remln){
    if (remln && token.parent && token.parent.children)
    {
      var ar = token.parent.children;
      var index = ar.indexOf(token);
      ar.splice(ar.indexOf(token), 1);
      token.parent = null;
      if (index > 0 && ar[index].type == 'text')
        ar[index].data = ar[index].data.replace(/(\r\n?|\n\r?)\s*$/, '');
    }
    else
    {
      this.replaceToken(token, {
        type: 'text',
        data: ''
      });
    }
  },
  replaceToken: function(token, cfg){
    var parent = token.parent;

    for (var key in token)
      if (token.hasOwnProperty(key))
        delete token[key];

    for (var key in cfg)
      token[key] = cfg[key];

    token.parent = parent;
  },
  insertBefore: function(refToken, token){
    if (refToken.parent)
    {
      var children = refToken.parent.children;
      var idx = children.indexOf(refToken);

      token.parent = refToken.parent;
      if (idx == -1)
        children.push(token);
      else
        children.splice(idx, 0, token);
    }
  },
  insertAfter: function(refToken, token){
    if (refToken.parent)
    {
      var children = refToken.parent.children;
      var idx = children.indexOf(refToken);

      token.parent = refToken.parent;
      if (idx == -1)
        children.push(token);
      else
        children.splice(idx + 1, 0, token);
    }
  }
};