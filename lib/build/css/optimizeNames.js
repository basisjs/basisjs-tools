var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = {};
  var classMap = {};
  var warnCount = 0;

  if (!flow.options.cssOptimizeNames)
  {
    fconsole.log('Skiped.')
    fconsole.log('Use option --css-optimize-names');
    return;
  }

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

  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    switch (file.type){
      case 'html':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atHtml.walk(file.ast, {
          'tag': function(node){
            var attrs = atHtml.getAttrs(node);
            
            if (attrs.id)
              addId(attrs.id, node, 'html-id');

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
        //console.log(atCss.parse('#asd .xcv.dfg, .sdfsdf:hover{}')[2][2][4]);

        atCss.walk(file.ast, {
          'shash': function(token){
            addId(token[2], token, 'style-id');
          },
          'clazz': function(token){
            addClass(token[2][2], token[2], 'style-class');
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
                    addId(this.tokenValue(token), token, 'tmpl-id');
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
                          binding.len = JSON.stringify(binding);
                          addClass(binding[0] + binding[1], binding, 'tmpl-bool'); // binding[0] = '' && binding.push(alias)
                          break;
                        case 4: // enum
                          binding.len = JSON.stringify(binding);
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

  var totalSaving = 0;
  var typeSaving = {
    html: 0,
    style: 0,
    tmpl: 0
  };

  var warnNoStyle = [];
  var warnNoHtml = [];
  for (var name in classMap)
  {
    var list = classMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      warnNoStyle.push('class: ' + name);

    if (!inHtml && inCss)
      warnNoHtml.push('class: ' + name);
  }

  for (var name in idMap)
  {
    var list = idMap[name];
    var inHtml = list.sources.html || list.sources.tmpl;
    var inCss = list.sources.style;

    if (inHtml && !inCss)
      warnNoStyle.push('id: ' + name);

    if (!inHtml && inCss)
      warnNoHtml.push('id: ' + name);
  }

  if (warnNoHtml.length)
  {
    fconsole.log('[!] Never used in html & templates');
    fconsole.list(warnNoHtml, ' ');
    fconsole.log();
  }

  if (warnNoStyle.length)
  {
    fconsole.log('[!] No styles for');
    fconsole.list(warnNoStyle, ' ');
    fconsole.log();
  }

  if (warnCount)
    fconsole.log('[WARN] ' + warnCount + ' problem(s) detected, name optimizing may breakdown app');

  fconsole.start('Process class names');
  Object.keys(classMap).sort(function(a, b){
    return (b.length - 1) * classMap[b].length - (a.length - 1) * classMap[a].length;
  }).forEach(function(name, idx){
    function replaceFn(cls){
      return cls == name ? replace : cls;
    }
    function replaceStr(str){
      return str.trim().split(/\s+/).map(replaceFn).join(' ');
    }
    function toBase52(num){
      var res = '';
      do {
        var n = num % 52;
        res = String.fromCharCode((n % 26) + (n < 26 ? 97 : 65)) + res;
        num = parseInt(num / 52);
      } while (num);
      return res;
    }

    var list = classMap[name];
    var replace = toBase52(idx);
    var oneSaving = name.length - replace.length;
    var saving = oneSaving * list.length;

    totalSaving += saving;
    fconsole.log(name, '->', replace, '(' + saving + ')');

    for (var i = 0, item; item = list[i]; i++)
    {
      var token = item.token;
      typeSaving[item.type.split('-')[0]] += oneSaving;
      switch (item.type){
        case 'html-class':
          token.class = replaceStr(token.class);
          break;
        case 'style-class':
          token[2] = replace;
          break;
        case 'tmpl-class':
          token.context.tokenValue(token, replaceStr(token.context.tokenValue(token)))
          break;
        case 'tmpl-bool':
          token[0] = '';
          token.push(replace);
          break;
        case 'tmpl-enum':
          if (!token[4])
          {
            typeSaving.tmpl += token[0].length - 3 - (token[3].length * 4 - 1); // make correct size saving calculation
            token[0] = '';
            token[4] = token[3].map(function(cls){
              return token[0] + cls;
            });
          }

          token[4] = token[4].map(replaceFn);
          break;
        default:
          console.error('Unknown token type - ' +cfg.type);
          process.exit();
      }
    }
  });
  fconsole.endl();

  fconsole.start('Total class rename saving:', totalSaving + ' bytes');
  fconsole.list(Object.keys(typeSaving).map(function(type){
    return type + ': ' + (type == 'tmpl' ? '~' : '') + typeSaving[type] + ' bytes';
  }));

  // var saving = 0;
  // Object.keys(idMap).sort(function(a, b){
  //   return (b.length - 1) * idMap[b].length - (a.length - 1) * idMap[a].length;
  // }).forEach(function(name, idx){
  //   saving += (name.length - 1) * idMap[name].length;
  //   fconsole.log(name, (name.length - 1) * idMap[name].length, '_' + idx);
  // });
  // console.log(saving); 

  //process.exit();
}).handlerName = '[css] Optimize names';