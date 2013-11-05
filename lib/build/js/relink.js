var at = require('../../ast').js;

//
// export handler
//

(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;
  var basisResource = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'resource']);
  var basisRequire = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'require']);

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      if (flow.options.jsBuildMode)
      {
        // replace value for idx
        // TODO: make sure it's has no side effect, otherwise this replacement may break code
        file.throwCodes.forEach(function(item){
          item[2][1] = ['num', item[0]];
        });
      }

      if (file.deps.length || file.resources.length)
      {
        fconsole.start(file.relpath);

        file.ast = at.walk(file.ast, {
          'call': function(token){
            var expr = token[1];
            var args = token[2];

            switch (this.scope.resolve(token[1]))
            {
              case basisResource:
                var code = at.translate(token);
                var file = token.resourceRef;

                if (file && file.jsRef)
                {
                  token[2] = [['string', file.jsRef]];
                  flow.console.log(code + ' -> ' + at.translate(token));
                }
                else
                {
                  if (token.resourceRef)
                    flow.warn({
                      file: this.file.relpath,
                      message: code + ' has no jsRef (ignored)'
                    });
                }

                break;

              case basisRequire:
                if (args[0] && args[0][0] == 'string')
                {
                  if (!token.resourceRef)
                  {
                    //console.log(at.translate(token));
                    flow.warn({
                      fatal: true,
                      file: this.file.relpath,
                      message: 'token `' + at.translate(token) + '` has no file ref'
                    });
                  }
                  // cut off args except first one
                  args.splice(1, args.length);
                  // replace for resource reference
                  args[0][1] = token.resourceRef.jsRef;
                }
            }
          }
        }, { file: file });

        fconsole.endl();
      }
    }

}).handlerName = '[js] Modify basis.resource calls';
