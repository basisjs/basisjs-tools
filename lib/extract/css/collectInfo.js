var html = require('../html');
var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

(module.exports = function(flow){
  var fconsole = flow.console;
  var sortThemes = flow.tmpl.sortThemes;
  var idMap = {};
  var idMapRemovals = {};
  var classMap = {};
  var classMapRemovals = {};
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

  function add(map, file, key, token, type, loc){
    var typePart = type.split('-');
    var themes = file.themes || appThemes;

    themes.forEach(function(theme){
      var list = getMap(map, theme, key);

      fconsole.log(typePart[1] + ': ' + key + ' (' + theme + ')');

      list.push({
        file: file,
        loc: loc,
        token: token,
        type: type
      });
      list.sources[typePart[0]] = true;
    });
  }

  function processTemplateAst(file, ast, idMap, classMap){
    atTmpl.walk(ast, flow.js.basis.template, {
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
                var loc = token.valueLocMap ? token.valueLocMap[name] : token.loc;
                add(classMap, this.file, name, token, 'tmpl-class', loc);
              }, this);
            }

            if (token[1])
              token[1].forEach(function(binding){
                var bindingName = binding[1];
                var classes = this.getBindingClassNames(binding);
                var anim = false;

                if (!classes)
                  return fconsole.log('[!] unpredictable binding: ' + binding[0] + '{' + bindingName + '}');

                if (/^anim:/.test(bindingName))
                {
                  bindingName = bindingName.substr(5);
                  anim = true;
                }

                classes.forEach(function(className){
                  add(classMap, this.file, className, binding, 'tmpl-class-binding'); // binding[0] = '' && binding.push(alias)
                  if (anim)
                    add(classMap, this.file, className + '-anim', binding, 'tmpl-class-anim');
                }, this);
              }, this);

            break;
        }
      }
    }, { file: file });
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
            var attrsInfo = node.info.attrs;

            if (attrs.id)
              add(idMap, this.file, attrs.id, attrs, 'html-id', this.file.location(attrsInfo.id && attrsInfo.id.start));

            if (attrs.class)
            {
              var loc = attrsInfo.class && attrsInfo.class.start;
              attrs.class.trim().split(/\s+/).forEach(function(name){
                add(classMap, this.file, name, attrs, 'html-class', loc && this.file.location({
                  line: loc.line,
                  column: loc.column + attrs.class.indexOf(name)
                }));
              }, this);
            }
          }
        }, { file: file });

        fconsole.endl();
        break;

      case 'style':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.classes)
          file.classes.forEach(function(entry){
            add(classMap, file, entry[2], entry, 'style-class');
          });

        if (file.ids)
          file.ids.forEach(function(entry){
            add(idMap, file, entry[2], entry, 'style-id');
          });

        fconsole.endl();
        break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.ast)
        {
          processTemplateAst(file, file.ast, idMap, classMap);

          if (file.removals)
          {
            var removals = file.removals.map(function(fragment){
              return fragment.token;
            });
            processTemplateAst(file, removals, idMapRemovals, classMapRemovals);
          }
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
    var loc = entry.loc || entry.token.loc;
    var warning = {
      theme: theme,
      loc: loc,
      value: value,
      filename: entry.file.originator || entry.file.hostFilename || entry.file.filename,
      isolate: entry.file.isolate
    };
    var filename = loc
      ? loc.replace(/\:\d+\:\d+$/, '')
      : entry.file.generatedFrom || entry.file.filename;

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
      var removalsList = classMapRemovals[theme] && classMapRemovals[theme][name];
      var inHtml = list.sources.html || list.sources.tmpl;
      var inCss = list.sources.style;
      var removedFromHtml = removalsList && (removalsList.sources.html || removalsList.sources.tmpl);

      if (inHtml && !inCss)
        list.forEach(function(entry){
          addWarn(warnNoStyle, entry, theme, '.' + name);
        });

      if (!inHtml && inCss)
      {
        list.forEach(function(entry){
          // ignore warnings for classes in removed parts but in isolated template only
          if (!removedFromHtml || !entry.file.isolate)
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

      // group by warn message and theme
      var map = fileWarns.reduce(function(res, warn){
        var warnId = [warn.value, warn.filename != fn ? warn.filename : '', warn.isolate || ''].join('\x00');

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
        Object.keys(warnMap).forEach(function(theme){
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
        {
          var info = warnId.split('\x00');
          var warn = {
            file: fn,
            loc: map[warnId][theme],
            theme: theme,
            message: message + ': ' + (info[2] ? info[0].replace(new RegExp('^(.?)' + info[2]), '$1') : info[0])
          };

          if (info[1])
            warn.originator = info[1];
          if (info[2])
            warn.isolate = info[2];

          flow.warn(warn);
        }
    }
  }

  copyWarnsToFlow(warnNoStyle, 'No style rules for');
  copyWarnsToFlow(warnNoHtml, 'Never used in html or templates');

}).handlerName = '[css] Collect info';
