var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

(module.exports = function(flow){
  function addId(id, token, type){
    var list = idMap[id];

    if (!list)
    {
      list = idMap[id] = [];
      list.sources = {};
    }

    fconsole.log('id:', id);
    list.push({
      token: token,
      type: type
    });
    list.sources[type.split('-')[0]] = true;
  }
  function addClass(name, token, type){
    var list = classMap[name];

    if (!list)
    {
      list = classMap[name] = [];
      list.sources = {};
    }

    fconsole.log('class:', name);
    list.push({
      token: token,
      type: type
    });
    list.sources[type.split('-')[0]] = true;
  }

  var fconsole = flow.console;
  var idMap = {};
  var classMap = {};
  var warnCount = 0;

  flow.css.idMap = idMap;
  flow.css.classMap = classMap;

  if (!flow.options.cssOptimizeNames && !flow.options.cssCutUnused)
  {
    fconsole.log('Not required (used for --css-optimize-names and --css-cut-unused)')
    return;
  }  

  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    switch (file.type){
      case 'html':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atHtml.walk(file.ast, {
          'tag': function(node){
            var attrs = atHtml.getAttrs(node);
            
            if (attrs.id)
              addId(attrs.id, attrs, 'html-id');

            if (attrs.class)
            {
              attrs.class.trim().split(/\s+/).forEach(function(name){
                addClass(name, attrs, 'html-class');
              });
            }
          }
        });

        fconsole.endl();
        break;

      case 'style':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atCss.walk(file.ast, {
          'shash': function(token, parent, idx, stack){
            addId(token[2], token, 'style-id');
            token.stack = stack.slice(stack.length - 4).reverse();
          },
          'clazz': function(token, parent, idx, stack){
            addClass(token[2][2], token[2], 'style-class');
            token[2].stack = stack.slice(stack.length - 4).reverse();
          }
        });

        fconsole.endl();
        break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.ast)
        {
          atTmpl.walk(file.ast, {
            'attr': function(token, parentToken){
              switch (this.tokenName(token))
              {
                case 'id':
                  if (token[1])
                  {
                    warnCount++;
                    fconsole.log('[WARN] binding on id attribute: ', this.tokenValue(token));
                  }
                  else
                  {
                    token.context = this;
                    addId(this.tokenValue(token), token, 'tmpl-id');
                  }
                  break;

                case 'class':
                  var value = this.tokenValue(token).trim();

                  if (value)
                  {
                    token.context = this;
                    value.split(/\s+/).forEach(function(name){
                      addClass(name, token, 'tmpl-class');
                    });
                  }

                  if (token[1])
                  {
                    token[1].forEach(function(binding){
                      //console.log('>>>', binding);
                      switch (binding.length){
                        case 2:
                          warnCount++;
                          fconsole.log('[WARN] unpredictable binding: ' + binding[0] + '{' + binding[1] + '}');
                          break;
                        case 3: // bool
                          addClass(binding[0] + binding[1], binding, 'tmpl-bool'); // binding[0] = '' && binding.push(alias)
                          break;
                        case 4: // enum
                          binding[3].forEach(function(name){
                            addClass(binding[0] + name, binding, 'tmpl-enum'); // binding[0] = '' && binding.push([alias, alias])
                          });
                          break;
                      }
                    });
                  }
                  break;
              }
            }
          });
        }

        fconsole.endl();
        break;
    }
  }

}).handlerName = '[css] Collect names';
