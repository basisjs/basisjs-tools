(module.exports = function(flow){
  var fconsole = flow.console;
  var idMap = flow.css.idMap;
  var classMap = flow.css.classMap;
  var totalSaving = 0;

  if (!flow.options.cssOptimizeNames)
  {
    fconsole.log('Skiped.')
    fconsole.log('Use option --css-optimize-names');
    return;
  }

  //
  // class rename
  //

  fconsole.start('Process class names');

  var classRenameSaving = 0;
  var typeSaving = {
    html: 0,
    style: 0,
    tmpl: 0
  };

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

    classRenameSaving += saving;
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
          token.context.tokenValue(token, replaceStr(token.context.tokenValue(token)));
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
          console.error('Unknown token type - ' + cfg.type);
          process.exit();
      }
    }
  });
  fconsole.endl();

  fconsole.start('Total class rename saving:', classRenameSaving + ' bytes');
  fconsole.list(Object.keys(typeSaving).map(function(type){
    return type + ': ' + (type == 'tmpl' ? '~' : '') + typeSaving[type] + ' bytes';
  }));
  fconsole.endl();


  //
  // id
  //

  fconsole.start('Process id');

  var idRenameSaving = 0;
  var typeSaving = {
    html: 0,
    style: 0,
    tmpl: 0
  };

  Object.keys(idMap).sort(function(a, b){
    return (b.length - 1) * idMap[b].length - (a.length - 1) * idMap[a].length;
  }).forEach(function(name, idx){
    var list = idMap[name];
    var replace = toBase52(idx);
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
          console.error('Unknown token type - ' + cfg.type);
          process.exit();
      }
    }
  });
  fconsole.endl();

  fconsole.start('Total id rename saving:', idRenameSaving + ' bytes');
  fconsole.list(Object.keys(typeSaving).map(function(type){
    return type + ': ' + typeSaving[type] + ' bytes';
  }));
  fconsole.endl();

  fconsole.start('Total rename saving:', idRenameSaving + ' bytes');

}).handlerName = '[css] Optimize names';

function toBase52(num){
  var res = '';
  do {
    var n = num % 52;
    res = String.fromCharCode((n % 26) + (n < 26 ? 97 : 65)) + res;
    num = parseInt(num / 52);
  } while (num);
  return res;
}