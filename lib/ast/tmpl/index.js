
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
    typeMap[4] = ATTRIBUTE;
    typeMap[5] = ATTRIBUTE;
    typeMap[6] = ATTRIBUTE;
    typeMap[tmpl.TYPE_TEXT] = TEXT;
    typeMap[tmpl.TYPE_COMMENT] = COMMENT;

    BaseContext = module.at_base_context = function(ext){
      if (ext)
        for (var key in ext)
          this[key] = ext[key];
    };
    BaseContext.prototype = {
      hasBindings: function(token){
        return !!token[tmpl.TOKEN_BINDINGS];
      },
      getAttrs: function(token){
        return (token[tmpl.TOKEN_TYPE] == tmpl.TYPE_ELEMENT && token[tmpl.ELEMENT_ATTRS]) || [];
      },
      getChildren: function(token){
        return (token[tmpl.TOKEN_TYPE] == tmpl.TYPE_ELEMENT && token[tmpl.ELEMENT_CHILDS]) || [];
      },
      tokenType: function(token){
        return typeMap[token[tmpl.TOKEN_TYPE]];
      },
      tokenName: function(token){
        switch (token[tmpl.TOKEN_TYPE])
        {
          case tmpl.TYPE_ELEMENT:
            return token[tmpl.ELEMENT_NAME];

          case tmpl.TYPE_ATTRIBUTE:
            return token[tmpl.ATTR_NAME];

          case 4:
            return 'class';

          case 5:
            return 'style';

          case 6:
            return 'event-' + token[1];

          default:
            return '#' + token[tmpl.TOKEN_TYPE];
        }
      },
      tokenValue: function(token, value){
        switch (token[tmpl.TOKEN_TYPE])
        {
          case tmpl.TYPE_ATTRIBUTE:
            if (arguments.length > 1)
              token[tmpl.ATTR_VALUE] = value;
            return token[tmpl.ATTR_VALUE] || '';

          case 4:
          case 5:
            if (arguments.length > 1)
              token[tmpl.ATTR_VALUE - 1] = value;
            return token[tmpl.ATTR_VALUE - 1] || '';

          case 6:
            if (arguments.length > 1)
              token[2] = value;
            return token[2] || token[1];

          case tmpl.TYPE_TEXT:
            if (arguments.length > 1)
              token[tmpl.TEXT_VALUE] = value;
            return token[tmpl.TEXT_VALUE];

          case tmpl.TYPE_COMMENT:
            if (arguments.length > 1)
              token[tmpl.COMMENT_VALUE] = value;
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
  walk: function(ast, module, handlers, extContext){
    function walk(ast, parentToken, stIdx){
      //console.log(JSON.stringify(ast));
      for (var i = stIdx || 0, token; token = ast[i]; i++)
      {
        var tokenType = this.tokenType(token);

        var handler = handlers[tokenType];
        if (typeof handler == 'function')
          handler.call(this, token, parentToken);

        if (tokenType == ELEMENT)
        {
          switch (version)
          {
            case 1:
              var attrs = this.getAttrs(token);
              if (attrs)
                walk.call(this, attrs, token);

              var children = this.getChildren(token);
              if (children)
                walk.call(this, children, token);
              break;

            case 2:
              walk.call(this, token, token, 4);
              break;

            default:
              console.warn('[ERROR] unsupported template declaration version: ', version);
              porcess.exit();
          }
        }
      }
    }

    var version = (module && module.DECLARATION_VERSION) || 1;
    if (module)
      return walk.call(getContext(module, extContext), ast);
    else
    {
      console.warn('[ERROR] tmpl ast.walk called, but basis.template module not found');
      porcess.exit();
    }
  },
  translate: function(ast){
    return JSON.stringify(ast);
  }
};
