var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

(module.exports = function(flow){
  function addId(file, id, token, type){
    var list = idMap[id];

    if (!list)
    {
      list = idMap[id] = [];
      list.sources = {};
    }

    fconsole.log('id:', id);
    list.push({
      file: file,
      token: token,
      type: type
    });
    list.sources[type.split('-')[0]] = true;
  }
  function addClass(file, name, token, type){
    var list = classMap[name];

    if (!list)
    {
      list = classMap[name] = [];
      list.sources = {};
    }

    fconsole.log('class:', name);
    list.push({
      file: file,
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
              addId(this.file, attrs.id, attrs, 'html-id');

            if (attrs.class)
            {
              attrs.class.trim().split(/\s+/).forEach(function(name){
                addClass(this.file, name, attrs, 'html-class');
              }, this);
            }
          }
        }, { file: file });

        fconsole.endl();
        break;

      case 'style':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atCss.walk(file.ast, {
          'shash': function(token, parent, idx, stack){
            addId(this.file, token[2], token, 'style-id');
            token.stack = stack.slice(stack.length - 4).reverse();
          },
          'clazz': function(token, parent, idx, stack){
            addClass(this.file, token[2][2], token[2], 'style-class');
            token[2].stack = stack.slice(stack.length - 4).reverse();
          }
        }, { file: file });

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
                    flow.warn({
                      file: this.file.relpath,
                      message: 'binding on id attribute: ' + JSON.stringify(token)
                    });
                  }
                  else
                  {
                    token.context = this;
                    addId(this.file, this.tokenValue(token), token, 'tmpl-id');
                  }
                  break;

                case 'class':
                  var value = this.tokenValue(token).trim();

                  if (value)
                  {
                    token.context = this;
                    value.split(/\s+/).forEach(function(name){
                      addClass(this.file, name, token, 'tmpl-class');
                    }, this);
                  }

                  if (token[1])
                  {
                    token[1].forEach(function(binding){
                      //console.log('>>>', binding);
                      switch (binding.length){
                        case 2:
                          warnCount++;
                          flow.warn({
                            file: this.file.relpath,
                            message: 'unpredictable binding: ' + binding[0] + '{' + binding[1] + '}'
                          });
                          break;
                        case 3: // bool
                          addClass(this.file, binding[0] + binding[1], binding, 'tmpl-bool'); // binding[0] = '' && binding.push(alias)
                          break;
                        case 4: // enum
                          binding[3].forEach(function(name){
                            addClass(this.file, binding[0] + name, binding, 'tmpl-enum'); // binding[0] = '' && binding.push([alias, alias])
                          }, this);
                          break;
                      }
                    }, this);
                  }
                  break;
              }
            }
          }, { file: file });
        }

        fconsole.endl();
        break;
    }
  }

  if (warnCount)
    fconsole.log('[WARN] ' + warnCount + ' problem(s) detected, name optimizing may breakdown app\n');

}).handlerName = '[css] Collect names';
