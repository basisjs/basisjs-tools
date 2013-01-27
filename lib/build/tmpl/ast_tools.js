
var ELEMENT = 'tag';
var ATTRIBUTE = 'attr';
var TEXT = 'text';
var COMMENT = 'comment';

function getContext(module, extContext){
  var BaseContext = module.at_base_context;

  if (!BaseContext)
  {
    var tmpl = module;
    var typeMap = {};
    typeMap[tmpl.TYPE_ELEMENT] = ELEMENT;
    typeMap[tmpl.TYPE_ATTRIBUTE] = ATTRIBUTE;
    typeMap[tmpl.TYPE_TEXT] = TEXT;
    typeMap[tmpl.TYPE_COMMENT] = COMMENT;

    BaseContext = module.at_base_context = function(ext){
      if (ext)
        for (var key in ext)
          this[key] = ext[key];
    };
    BaseContext.prototype = {
      getAttrs: function(token){
        return (token[tmpl.TOKEN_TYPE] == tmpl.TYPE_ELEMENT && token[tmpl.ELEMENT_ATTRS]) || [];
      },
      getChildren: function(token){
        return (token[tmpl.TOKEN_TYPE] == tmpl.TYPE_ELEMENT && token[tmpl.ELEMENT_CHILDS]) || [];
      },
      tokenType: function(token){
        return typeMap[token[tmpl.TOKEN_TYPE]]
      },
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
      }
    };
  }

  return new BaseContext(extContext);
}


module.exports = {
  walk: function(ast, handlers, extContext){
    function walk(ast, parentToken){
      //console.log(JSON.stringify(ast));
      for (var i = 0, token; token = ast[i]; i++)
      {
        var tokenType = this.tokenType(token);

        var handler = handlers[tokenType];
        if (typeof handler == 'function')
          handler.call(this, token, parentToken);

        if (tokenType == ELEMENT)
        {
          var attrs = this.getAttrs(token);
          if (attrs)
            walk.call(this, attrs, token);

          var children = this.getChildren(token);
          if (children)
            walk.call(this, children, token);
        }
      }
    }

    if (global.basis.template)
      return walk.call(getContext(global.basis.template, extContext), ast);
    else
    {
      console.warn('[ERROR] tmpl ast.walk called, but basis.template module not found');
      porcess.exit()
    }
  },
  translate: function(ast){
    return JSON.stringify(ast);
  }
};