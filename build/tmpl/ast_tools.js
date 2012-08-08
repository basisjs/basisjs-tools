
var tmpl = global.basis.template;

var typeMap = {};
typeMap[tmpl.TYPE_ELEMENT] = 'tag';
typeMap[tmpl.TYPE_ATTRIBUTE] = 'attr';
typeMap[tmpl.TYPE_TEXT] = 'text';
typeMap[tmpl.TYPE_COMMENT] = 'comment';

module.exports = {
  tokenName: function(token){
    switch (token[tmpl.TOKEN_TYPE])
    {
      case tmpl.TYPE_ELEMENT:
        return token[tmpl.ELEMENT_NAME];

      case tmpl.TYPE_ATTRIBUTE:
        return token[tmpl.ATTR_NAME];

      default:
        return '#' + token[tmpl.TOKEN_TYPE];
    }
  },
  tokenValue: function(token){
    switch (token[tmpl.TOKEN_TYPE])
    {
      case tmpl.TYPE_ATTRIBUTE:
        return token[tmpl.ATTR_VALUE];
      case tmpl.TYPE_TEXT:
        return token[tmpl.TEXT_VALUE];
      case tmpl.TYPE_COMMENT:
        return token[tmpl.COMMENT_VALUE];

      default:
        return '';
    }
  },
  walk: function(ast, handlers, context){

    function walk(ast, parentToken){
      //console.log(JSON.stringify(ast));
      for (var i = 0, token; token = ast[i]; i++)
      {
        var tokenType = token[tmpl.TOKEN_TYPE];

        var handler = handlers[typeMap[tokenType]];
        if (typeof handler == 'function')
          handler.call(context, token, parentToken);

        if (tokenType == tmpl.TYPE_ELEMENT)
        {
          var attrs = token[tmpl.ELEMENT_ATTRS];
          if (attrs)
            walk(attrs, token);

          var childs = token[tmpl.ELEMENT_CHILDS];
          if (childs)
            walk(childs, token);
        }
      }
    }

    walk(ast);
  },
  translate: function(ast){
    return JSON.stringify(ast);
  }
};