
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
    if (file.type == 'script' && (file.deps.length || file.resources.length))
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
                return;
              }

              flow.console.log('[WARN] ' + code + ' is not processed, because has no jsRef (ignored)');

              break;

            case basisRequire:
              return ['block'];
          }
        }
      });

      fconsole.endl();
    }

}).handlerName = '[js] Modify basis.resource calls';




