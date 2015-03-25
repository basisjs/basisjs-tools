var html = require('../html');
var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

(module.exports = function(flow){
  var fconsole = flow.console;
  var sortThemes = flow.tmpl.sortThemes;
  var idMap = {};
  var classMap = {};
  var bindingWarningCount = 0;
  var appThemes = Object.keys(flow.tmpl.themes);

  if (!appThemes.length)
    appThemes = ['all'];

  flow.css.idMap = idMap;
  flow.css.classMap = classMap;


  //
  // Collect names
  //

  function getMap(map, theme, key){
    if (!hasOwnProperty.call(map, theme))
      map[theme] = {};

    var themeMap = map[theme];

    if (!hasOwnProperty.call(themeMap, key))
    {
      var list = [];
      list.sources = {};
      list.nested = [];
      list.key = key;
      list.postfix = '';
      themeMap[key] = list;

      var baseKey = key.replace(/-anim$/, '');
      if (baseKey != key)
      {
        list.postfix = '-anim';
        getMap(map, theme, baseKey).nested.push(key);
      }
    }

    return themeMap[key];
  }

  function add(map, file, key, token, type){
    var typePart = type.split('-');
    var themes = file.themes || appThemes;

    themes.forEach(function(theme){
      var list = getMap(map, theme, key);

      fconsole.log(typePart[1] + ': ' + key);

      list.push({
        file: file,
        token: token,
        type: type
      });
      list.sources[typePart[0]] = true;
    });
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
                    bindingWarningCount++;
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
                    token[1].forEach(function(binding){
                      var bindingName = binding[1];
                      var classes = this.getBindingClassNames(binding);
                      //var type = this.getClassBindingType(binding);
                      var anim = false;

                      if (!classes)
                        return fconsole.log('[!] unpredictable binding: ' + binding[0] + '{' + bindingName + '}');

                      if (/^anim:/.test(bindingName))
                      {
                        bindingName = bindingName.substr(5);
                        anim = true;
                      }

                      classes.forEach(function(className){
                        add(classMap, this.file, className, binding, 'tmpl'); // binding[0] = '' && binding.push(alias)
                        if (anim)
                          add(classMap, this.file, className + '-anim', binding, 'tmpl-anim');
                      }, this);
                    }, this);

                  break;
              }
            }
          }, { file: file });
        }

        fconsole.endl();
        break;
    }
  }

  if (bindingWarningCount)
    fconsole.log('[WARN] ' + bindingWarningCount + ' potential binding problem(s) detected, name optimizing may breakdown app\n');


  //
  // validate names
  //

  var warnNoStyle = {};
  var warnNoHtml = {};

  function addWarn(map, entry, theme, value){
    var warning = {
      theme: theme,
      loc: entry.token.loc,
      value: value
    };
    var filename = entry.token.loc
      ? entry.token.loc.replace(/\:\d+\:\d+$/, '')
      : entry.file.generatedFrom || entry.file.relpath;

    if (!hasOwnProperty.call(map, filename))
    {
      map[filename] = [warning];
      map[filename].file = entry.file;
    }
    else
    {
      map[filename].push(warning);
    }
  }

  for (var theme in classMap)
    for (var name in classMap[theme])
    {
      var list = classMap[theme][name];
      var inHtml = list.sources.html || list.sources.tmpl;
      var inCss = list.sources.style;

      if (inHtml && !inCss)
        list.forEach(function(entry){
          addWarn(warnNoStyle, entry, theme, '.' + name);
        });

      if (!inHtml && inCss)
      {
        list.forEach(function(entry){
          addWarn(warnNoHtml, entry, theme, '.' + name);
        });

        // mark as unused
        list.unused = true;
      }
    }

  for (var theme in idMap)
    for (var name in idMap[theme])
    {
      var list = idMap[theme][name];
      var inHtml = list.sources.html || list.sources.tmpl;
      var inCss = list.sources.style;

      if (inHtml && !inCss)
        list.forEach(function(entry){
          addWarn(warnNoStyle, entry, theme, '#' + name);
        });

      if (!inHtml && inCss)
      {
        list.forEach(function(entry){
          addWarn(warnNoHtml, entry, theme, '#' + name);
        });

        // mark as unused
        list.unused = true;
      }
    }

  function copyWarnsToFlow(warns, message){
    for (var fn in warns)
    {
      var fileWarns = warns[fn];
      var file = fileWarns.file;

      // group by warn message and theme
      var map = fileWarns.reduce(function(res, warn){
        var warnId = warn.value;

        if (!hasOwnProperty.call(res, warnId))
          res[warnId] = {};

        var warnMap = res[warnId];

        if (!hasOwnProperty.call(warnMap, warn.theme))
          warnMap[warn.theme] = [warn.loc];
        else
          warnMap[warn.theme].add(warn.loc);

        return res;
      }, {});

      // merge by themes if loc lists are equal
      for (var warnId in map)
      {
        var warnMap = map[warnId];
        Object.keys(map[warnId]).forEach(function(theme){
          var locs = String(warnMap[theme]);
          var themes = [];

          // collect same loc list themes 
          for (var theme in warnMap)
            if (String(warnMap[theme]) == locs)
              themes.push(theme);

          // merge
          if (themes.length > 1)
          {
            warnMap[sortThemes(themes).join(' ')] = warnMap[theme];
            themes.forEach(function(theme){
              delete warnMap[theme];
            });
          }
        });
      }

      for (var warnId in map)
        for (var theme in map[warnId])
          flow.warn({
            file: fn,
            loc: map[warnId][theme],
            theme: theme,
            message: message + ': ' + warnId
          });
    }
  }

  copyWarnsToFlow(warnNoStyle, 'No style rules for');
  copyWarnsToFlow(warnNoHtml, 'Never used in html or templates');

}).handlerName = '[css] Collect info';
