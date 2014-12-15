
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
      version: module.DECLARATION_VERSION || 1,
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
      },
      walk: function(ast, handlers, parentToken, stIdx){
        for (var i = stIdx || 0, token; token = ast[i]; i++)
        {
          var tokenType = this.tokenType(token);
          var handler = handlers[tokenType];

          if (typeof handler == 'function')
            handler.call(this, token, parentToken);

          if (tokenType == ELEMENT)
          {
            switch (this.version)
            {
              case 1:
                var attrs = this.getAttrs(token);
                if (attrs)
                  this.walk(attrs, handlers, token);

                var children = this.getChildren(token);
                if (children)
                  this.walk(children, handlers, token);
                break;

              case 2:
              case 3:
                this.walk(token, handlers, token, 4);
                break;

              default:
                throw new Error('[ERROR] unsupported template declaration version: ' + this.version);
                process.exit(8);
            }
          }
        }
      },
      getBindingClassNames: function(binding){
        switch (this.version)
        {
          case 1:
          case 2:
            // unpredictable
            if (binding.length == 2 || binding[2] == -1)
              return false;

            if (binding.length == 3)
              // bool
              return [binding[0] + binding[1]];
            else
              // enum
              return binding[3].map(function(name){
                return binding[0] + name;
              });

          case 3:
            if (Array.isArray(binding[0]))
              return binding[0];

            // unpredictable
            if (!binding[2])
              return false;

            switch (binding[2])
            {
              case tmpl.CLASS_BINDING_BOOL:
                return [binding[0] + binding[3]];

              case tmpl.CLASS_BINDING_ENUM:
                return binding[5].map(function(name){
                  return binding[0] + name;
                });
              default:
                throw new Error('[ERROR] unknown binding type: ' + binding[2]);
            }

          default:
            throw new Error('[ERROR] unsupported version: ' + this.version);
        }
      },
      setBindingClassNames: function(binding, classes){
        switch (this.version)
        {
          case 1:
          case 2:
            switch (binding.length)
            {
              case 3: // bool
                binding[0] = '';
                binding[3] = Array.isArray(classes) ? classes[0] : classes;
                return;

              case 4: // enum
                binding[0] = '';
                binding[4] = Array.isArray(classes) ? classes : [classes];
                return;
            }
            break;

          case 3:
            binding[0] = Array.isArray(classes) ? classes : [classes];
            binding[3] = 0; // drop name as prefix overrided too
            break;

          default:
            throw new Error('[ERROR] unsupported version: ' + this.version);
        }
      }
    };
  }

  return new BaseContext(extContext);
}

function resolveContext(module, extContext){
  if (module && module.Template)
    return getContext(module, extContext);
  else
    throw new Error('[ERROR] basis.template module not found');
}

module.exports = {
  walk: function(ast, module, handlers, extContext){
    return resolveContext(module, extContext).walk(ast, handlers);
  },
  getBindingClassNames: function(module, token){
    return resolveContext(module).getBindingClassNames(token);
  },
  setBindingClassNames: function(module, token, classNames){
    return resolveContext(module).setBindingClassNames(token, classNames);
  },
  translate: function(ast){
    return JSON.stringify(ast);
  }
};
