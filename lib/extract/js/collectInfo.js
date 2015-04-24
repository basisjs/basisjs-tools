(module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;
  var ignoreBasisImplicitNames = ['require', 'exports', '__resources__', '__namespace_map__'];

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
          // temporary ignore some basis.js implicit names usage for now
          if (file.hostFilename == flow.js.basisScript && ignoreBasisImplicitNames.indexOf(name) != -1)
            return;

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
        scope.getOwnNames().forEach(function(name){
          // ignore scope if created by function but body is empty
          // (treat those functions as placeholder)
          if (scope.type == 'function' && scope.sourceToken && !scope.sourceToken[3].length)
            return;

          var info = scope.get(name);
          var type = info[0];

          // ignore any names except var and function declarations,
          // ang arguments but not for virtual scopes (implicit module wrapper function scope)
          if (type != 'var' && type != 'defun' && (type != 'arg' || scope.virtual))
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
