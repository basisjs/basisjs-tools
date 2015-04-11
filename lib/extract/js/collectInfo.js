(module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && file.ast)
    {
      fconsole.start(file.relpath);

      file.ast.scopes.forEach(function(scope){
        scope.usage = {};
      });

      file.ast.names.forEach(function(token){
        var name = token[1];
        var scope = token.scope.scopeByName(name);

        if (!scope)
        {
          flow.warn({
            file: file.hostFilename,
            message: 'Implicit global usage: ' + name,
            loc: file.location(token.start)
          });
        }
        else
        {
          if (!scope.usage)
            return;

          var info = scope.get(name);
          var type = info[0];

          // if some argument in argument list is used then all 
          // other arguments before it considered as used too, i.e.
          // | 'foo'.replace(/x(\d+)/g, function(m, num){
          // |   return num * 2;
          // | });
          // in this case `m` will be considered used as can't be
          // removed or omited
          if (type == 'arg' && info.extra)
            for (var i = 0; i < info.extra.index; i++)
              scope.usage[info.extra.list[i]] = true;
          
          scope.usage[name] = true;
        }
      });

      file.ast.scopes.forEach(function(scope){
        if (scope.virtual)
          return;

        scope.getOwnNames().forEach(function(name){
          if (scope.type == 'function' && scope.token && !scope.token[3].length)
            return;

          var info = scope.get(name);
          var type = info[0];

          if (type != 'var' && type != 'defun' && type != 'arg')
            return;

          if (!hasOwnProperty.call(scope.usage, name))
            flow.warn({
              file: file.hostFilename,
              message: 'Defined but never used: ' + name,
              loc: file.location(info.loc)
            });
        });
      });

      fconsole.endl(file.relpath);
    }
}).handlerName = '[js] Collect info';
