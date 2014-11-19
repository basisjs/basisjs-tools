var html = require('../html');
var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = {};
  var classMap = {};
  var warnCount = 0;

  flow.css.idMap = idMap;
  flow.css.classMap = classMap;


  //
  // Collect names
  //

  function getMap(map, key){
    if (!hasOwnProperty.call(map, key))
    {
      var list = [];
      list.sources = {};
      list.nested = [];
      list.key = key;
      list.postfix = '';
      map[key] = list;

      var baseKey = key.replace(/-anim$/, '');
      if (baseKey != key)
      {
        list.postfix = '-anim';
        getMap(map, baseKey).nested.push(key);
      }
    }

    return map[key];
  }

  function add(map, file, key, token, type){
    var typePart = type.split('-');
    var list = getMap(map, key);

    fconsole.log(typePart[1] + ': ' + key);

    list.push({
      file: file,
      token: token,
      type: type
    });
    list.sources[typePart[0]] = true;
  }

  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    switch (file.type){
      case 'html':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (!file.ast)
          html.processFile(file, flow);

        atHtml.walk(file.ast, {
          'tag': function(node){
            var attrs = atHtml.getAttrs(node);

            if (attrs.id)
              add(idMap, this.file, attrs.id, attrs, 'html-id');

            if (attrs.class)
            {
              attrs.class.trim().split(/\s+/).forEach(function(name){
                add(classMap, this.file, name, attrs, 'html-class');
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
            add(idMap, this.file, token[2], token, 'style-id');
            token.stack = stack.slice(stack.length - 4).reverse();
          },
          'clazz': function(token, parent, idx, stack){
            add(classMap, this.file, token[2][2], token[2], 'style-class');
            token[2].stack = stack.slice(stack.length - 4).reverse();
          }
        }, { file: file });

        fconsole.endl();
        break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.ast)
        {
          atTmpl.walk(file.ast, flow.js.basis.template, {
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
                    add(idMap, this.file, this.tokenValue(token), token, 'tmpl-id');
                  }
                  break;

                case 'class':
                  var value = this.tokenValue(token).trim();

                  if (value)
                  {
                    token.context = this;
                    value.split(/\s+/).forEach(function(name){
                      add(classMap, this.file, name, token, 'tmpl-class');
                    }, this);
                  }

                  if (token[1])
                  {
                    token[1].forEach(function(binding){
                      var bindingName = binding[1];
                      var anim = false;

                      if (/^anim:/.test(bindingName))
                      {
                        bindingName = bindingName.substr(5);
                        anim = true;
                      }

                      switch (binding.length)
                      {
                        case 2:
                          warnCount++;
                          // flow.warn({
                          //   file: this.file.relpath,
                          //   message: 'unpredictable binding: ' + binding[0] + '{' + binding[1] + '}'
                          // });
                          break;

                        case 3: // bool
                          add(classMap, this.file, binding[0] + bindingName, binding, 'tmpl-bool'); // binding[0] = '' && binding.push(alias)
                          if (anim)
                            add(classMap, this.file, binding[0] + bindingName + '-anim', binding, 'tmpl-boolAnim');
                          break;

                        case 4: // enum
                          binding[3].forEach(function(name){
                            add(classMap, this.file, binding[0] + name, binding, 'tmpl-enum'); // binding[0] = '' && binding.push([alias, alias])
                            if (anim)
                              add(classMap, this.file, binding[0] + name + '-anim', binding, 'tmpl-enumAnim');
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


  //
  // validate names
  //

  var warnNoStyle = {};
  var warnNoHtml = {};

  function addWarn(map, file, value){
    if (!map[file.relpath])
      map[file.relpath] = [];
    map[file.relpath].add(value);
  }

  for (var name in classMap)
  {
    var list = classMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      list.forEach(function(entry){
        addWarn(warnNoStyle, entry.file, '.' + name);
      });

    if (!inHtml && inCss)
    {
      list.forEach(function(entry){
        addWarn(warnNoHtml, entry.file, '.' + name);
      });

      // mark as unused
      list.unused = true;
    }
  }

  for (var name in idMap)
  {
    var list = idMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      list.forEach(function(entry){
        addWarn(warnNoStyle, entry.file, '#' + name);
      });

    if (!inHtml && inCss)
    {
      list.forEach(function(entry){
        addWarn(warnNoHtml, entry.file, '#' + name);
      });

      // mark as unused
      list.unused = true;
    }
  }

  for (var fn in warnNoStyle)
    flow.warn({
      file: fn,
      message: 'No style rules for: ' + warnNoStyle[fn].join(', ')
    });

  for (var fn in warnNoHtml)
    flow.warn({
      file: fn,
      message: 'Never used in html or templates: ' + warnNoHtml[fn].join(', ')
    });

}).handlerName = '[css] Collect info';
