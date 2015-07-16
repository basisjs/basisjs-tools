var htmlparser = require('htmlparser2');

var parserConfig = {
  lowerCaseTags: true
};

function prettyOffset(children, begin){
  var offset = '';
  if (begin)
  {
    var firstChild = children[1];
    if (firstChild)
    {
      if (firstChild.type == 'text' && firstChild.data.match(/(?:\r\n?|\n\r?)[ \t]*$/))
        offset = RegExp.lastMatch;
    }
    else
      offset = '\n  ';

    if (offset)
      children.unshift({ type: 'text', data: offset });
  }
  else
  {
    var idx = children.length - 2;
    var cursor;

    do
    {
      cursor = children[idx--];
    }
    while (cursor && cursor.type != 'text');

    if (cursor)
    {
      if (cursor.data.match(/[ \t]*$/))
        offset = RegExp.lastMatch;
    }
    else
      offset = '\n  ';

    if (offset)
    {
      var lastChildren = children[children.length - 1];
      if (lastChildren && lastChildren.type == 'text')
        lastChildren.data = lastChildren.data.replace(/(\r\n?|\n\r?)?$/, '\n' + offset);
      else
        children.push({ type: 'text', data: '\n' + offset });
    }
  }
}

function posToLineColumn(str, pos, offset){
  var lines = str.substr(0, pos).split('\n');
  return {
    line: lines.length - 1 + (offset || 0),
    column: lines.pop().length + (offset || 0)
  };
}

function walk(ast, handlers, context){
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

  if (typeof handlers == 'function')
    handlers = {
      '*': handlers
    };

  walkNode(ast);
}

function translate(ast){
  walk(ast, function(node){
    if (node.ast)
      node.data = (node.prefix || '') + translate(node.ast) + (node.postfix || '');
  });

  return htmlparser.DomUtils.getInnerHTML({
    children: Array.isArray(ast) ? ast : [ast]
  });
}

module.exports = {
  parse: function(html){
    // prepare parser
    var handler = new htmlparser.DomHandler(false, {
      refParent: true
    });
    var parser = new htmlparser.Parser(handler, parserConfig);
    var attrInfo = {};
    var head = null;
    var body = null;

    handler.onopentag = function(name, attribs){
      htmlparser.DomHandler.prototype.onopentag.call(this, name, attribs);

      var element = this._tagStack[this._tagStack.length - 1];
      element.info = {
        attrs: attrInfo,
        start: posToLineColumn(html, parser.startIndex),
        startContent: posToLineColumn(html, parser.endIndex)
      };

      attrInfo = {};

      switch (name)
      {
        case 'head':
          if (!head)
            head = element;
          break;

        case 'body':
          if (!body)
            body = element;
          break;

        case 'style':
        case 'script':
          element.type = 'tag';
          break;
      }
    };

    handler.onclosetag = function(){
      var element = this._tagStack[this._tagStack.length - 1];
      element.info.endContent = posToLineColumn(html, parser.startIndex);
      element.info.end = posToLineColumn(html, parser.endIndex);

      htmlparser.DomHandler.prototype.onclosetag.call(this);
    };

    parser.onattribdata = function(){
      htmlparser.Parser.prototype.onattribdata.apply(this, arguments);

      var startIndex = parser._tokenizer._sectionStart;
      var endIndex = parser._tokenizer._index;

      attrInfo[this._attribname] = {
        start: posToLineColumn(html, startIndex, 1),
        end: posToLineColumn(html, endIndex, 1)
      };
    };

    // parse html
    parser.parseComplete(html);

    var result = handler.dom;

    result.head = head;
    result.body = body;

    return result;
  },
  walk: walk,
  translate: translate,

  getElementByName: function(node, name){
    var nodes = Array.isArray(node) ? node.slice() : [node];

    while (nodes.length)
    {
      var node = nodes.shift();
      if (node.name == name)
        return node;
      if (node.children)
        nodes.unshift.apply(nodes, node.children);
    }

    return null;
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
    else
    {
      if (ast.body && ast.body.parent && ast.body.parent.children)
      {
        var html = ast.body.parent;
        html.children.splice(html.children.indexOf(ast.body), 0, node);
        return;
      }
    }

    if (begin)
    {
      insertPoint.unshift(node);
      prettyOffset(insertPoint, true);
    }
    else
    {
      prettyOffset(insertPoint);
      insertPoint.push(node);
      insertPoint.push({ type: 'text', data: '\n' });
    }
  },
  injectToBody: function(ast, node){
    var insertPoint = ast;

    if (ast.body)
      insertPoint = ast.body.children || (ast.body.children = []);

    prettyOffset(insertPoint);
    insertPoint.push(node);
    insertPoint.push({ type: 'text', data: '\n' });
  },

  removeToken: function(token, remln){
    if (remln && token.parent && token.parent.children)
    {
      var ar = token.parent.children;
      var index = ar.indexOf(token);
      ar.splice(ar.indexOf(token), 1);
      token.parent = null;

      if (index > 0 && ar[index].type == 'text')
      {
        var newData = ar[index].data.replace(/(\r\n?|\n\r?)\s*$/, '');
        if (newData)
          ar[index].data = newData;
        else
          ar.splice(index, 1);
      }
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
