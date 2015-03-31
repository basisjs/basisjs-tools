var atTmpl = require('../../ast/tmpl');

function toBase52(num){
  var res = '';

  do {
    var n = num % 52;
    res = String.fromCharCode((n % 26) + (n < 26 ? 97 : 65)) + res;
    num = parseInt(num / 52);
  } while (num);

  return res;
}

(module.exports = function(flow){
  var fconsole = flow.console;
  var themeIdMap = flow.css.idMap;
  var themeClassMap = flow.css.classMap;
  var totalSaving = 0;


  //
  // class rename
  //

  fconsole.start('Process class names');

  var tmplModule = flow.js.basis && flow.js.basis.template;
  var classReplaceMap = {};
  var classReplaceMapIdx = 0;
  var classRenameSaving = 0;
  var typeSaving = {
    html: 0,
    style: 0,
    tmpl: 0,
    'tmpl-overhead': 0
  };

  function getClassNameReplace(name){
    if (!hasOwnProperty.call(classReplaceMap, name))
      classReplaceMap[name] = toBase52(classReplaceMapIdx++);
    return classReplaceMap[name];
  }

  for (var theme in themeClassMap)
  {
    var classMap = themeClassMap[theme];
    Object.keys(classMap).filter(function(key){
      return !classMap[key].postfix;
    }).sort(function(a, b){
      return (b.length - 1) * classMap[b].length - (a.length - 1) * classMap[a].length;
    }).forEach(function processKey(name, idx){
      function replaceFn(cls){
        var result = cls == name ? replace : cls;
        if (item.type != 'tmpl')
        {
          var saving = cls.length - result.length;
          tokenSaving += saving;
          typeSaving['tmpl-overhead'] += saving;
        }
        return result;
      }
      function replaceStr(str){
        return str.trim().split(/\s+/).map(replaceFn).join(' ');
      }

      var list = classMap[name];
      var replace = getClassNameReplace(name) + list.postfix;
      var saving = 0;

      for (var i = 0, item, token; item = list[i]; i++)
      {
        token = item.token;
        tokenSaving = 0;

        switch (item.type){
          case 'html-class':
            token.class = replaceStr(token.class);
            break;
          case 'style-class':
            token[2] = replace;
            tokenSaving = name.length - replace.length;
            break;
          case 'tmpl-class':
            token.context.tokenValue(token, replaceStr(token.context.tokenValue(token)));
            break;
          case 'tmpl':
            tokenSaving = JSON.stringify(token).length;

            atTmpl.setBindingClassNames(tmplModule, token,
              atTmpl.getBindingClassNames(tmplModule, token).map(replaceFn)
            );

            tokenSaving -= JSON.stringify(token).length;

            if (tokenSaving < 0)
            {
              typeSaving['tmpl-overhead'] += -tokenSaving;
              tokenSaving = 0;
            }
            break;
          case 'tmpl-anim':
            // nothing todo
            break;
          default:
            flow.warn({
              fatal: true,
              message: 'Unknown token type - ' + cfg.type
            });
        }

        saving += tokenSaving;
        typeSaving[item.type.split('-')[0]] += tokenSaving;
      }

      classRenameSaving += saving;
      totalSaving += saving;
      fconsole.log(name, '->', replace, '(' + saving + ' / ' + list.length + ')');

      list.nested.forEach(function(nestedName){
        processKey(nestedName, idx);
      });
    });
  }
  fconsole.endl();

  classRenameSaving += typeSaving['tmpl-overhead'];
  fconsole.start('Total class rename saving:', classRenameSaving + ' bytes');
  fconsole.list(Object.keys(typeSaving).map(function(type){
    return type + ': ' + typeSaving[type] + ' bytes';
  }));
  fconsole.endl();


  //
  // id
  //

  fconsole.start('Process `id` attributes');

  var idReplaceMap = {};
  var idReplaceIdx = 0;
  var idRenameSaving = 0;
  var typeSaving = {
    html: 0,
    style: 0,
    tmpl: 0
  };

  function getIdReplace(name){
    if (!hasOwnProperty.call(idReplaceMap, name))
      idReplaceMap[name] = toBase52(idReplaceIdx++);
    return idReplaceMap[name];
  }

  for (var theme in themeIdMap)
  {
    var idMap = themeIdMap[theme];
    Object.keys(idMap).sort(function(a, b){
      return (b.length - 1) * idMap[b].length - (a.length - 1) * idMap[a].length;
    }).forEach(function(name, idx){
      var list = idMap[name];
      var replace = getIdReplace(name);
      var oneSaving = name.length - replace.length;
      var saving = oneSaving * list.length;

      idRenameSaving += saving;
      totalSaving += saving;
      fconsole.log(name, '->', replace, '(' + saving + ')');

      for (var i = 0, item; item = list[i]; i++)
      {
        var token = item.token;
        typeSaving[item.type.split('-')[0]] += oneSaving;
        switch (item.type){
          case 'html-id':
            token.id = replace;
            break;
          case 'style-id':
            token[2] = replace;
            break;
          case 'tmpl-id':
            token.context.tokenValue(token, replace);
            break;
          default:
            flow.warn({
              fatal: true,
              message: 'Unknown token type - ' + cfg.type
            });
        }
      }
    });
  }
  fconsole.endl();

  fconsole.start('Total id rename saving:', idRenameSaving + ' bytes');
  fconsole.list(Object.keys(typeSaving).map(function(type){
    return type + ': ' + typeSaving[type] + ' bytes';
  }));
  fconsole.endl();

  fconsole.start('Total rename saving:', idRenameSaving + ' bytes');

}).handlerName = '[css] Optimize names';

module.exports.skip = function(flow){
  if (!flow.options.cssOptimizeNames)
    return 'Use option --css-optimize-names';
};
