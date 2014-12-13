var html = require('../html');
var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = {};
  var classMap = {};
  var bindingWarningCount = 0;

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

  function addWarn(map, entry, value){
    var filename = entry.token.loc
          ? entry.token.loc.replace(/\:\d+\:\d+$/, '')
          : entry.file.generatedFrom || entry.file.relpath;
    var fileWarnings = map[filename];

    if (!fileWarnings)
    {
      fileWarnings = map[filename] = [];
      fileWarnings.file = entry.file;
    }

    fileWarnings.push({
      loc: entry.token.loc,
      value: value
        //+ (entry.token.loc ? ' ~ ' + entry.token.loc : '')
        //+ (entry.token.info_ ? ' !~ ' + entry.token.info_.value : '')
    });
  }

  for (var name in classMap)
  {
    var list = classMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      list.forEach(function(entry){
        addWarn(warnNoStyle, entry, '.' + name);
      });

    if (!inHtml && inCss)
    {
      list.forEach(function(entry){
        addWarn(warnNoHtml, entry, '.' + name);
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
        addWarn(warnNoStyle, entry, '#' + name);
      });

    if (!inHtml && inCss)
    {
      list.forEach(function(entry){
        addWarn(warnNoHtml, entry, '#' + name);
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
      var map = fileWarns.reduce(function(map, warn){
        var id = (file.themes || '') + ' ' + warn.value;
        if (!map.hasOwnProperty(id))
          map[id] = [warn.loc];
        else
          map[id].add(warn.loc);
        return map;
      }, {});

      for (var warnId in map)
        flow.warn({
          file: fn,
          loc: map[warnId],
          theme: (file.themes || []).join(' '),
          message: message + ': ' + warnId.split(' ')[1]
        });
    }
  }

  copyWarnsToFlow(warnNoStyle, 'No style rules for');
  copyWarnsToFlow(warnNoHtml, 'Never used in html or templates');

}).handlerName = '[css] Collect info';
