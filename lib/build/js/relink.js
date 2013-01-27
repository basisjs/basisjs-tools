
var at = require('../../ast').js;
var BASIS_RESOURCE = at.normalize('basis.resource');
var BASIS_REQUIRE = at.normalize('basis.require');

//
// export handler
//

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && (file.deps.length || file.resources.length))
    {
      fconsole.start(file.relpath);

      relinkScript(file, flow);

      fconsole.endl();
    }
};

module.exports.handlerName = '[js] Modify basis.resource calls';


//
// main part
//

function relinkScript(file, flow){
  file.ast = at.walk(file.ast, {
    "call": function(token){
      var expr = token[1];
      var args = token[2];

      switch (at.resolveName(expr, true))
      {
        case 'basis.resource':
          var arg0 = args[0];

          if (arg0[0] == 'string')
          {
            var filename = arg0[1];
            var file = flow.files.get(filename);

            if (file && file.jsRef)
            {
              var old = at.translate(['call', expr, args]);
              arg0[1] = file.jsRef;
              flow.console.log(old + ' -> ' + at.translate(['call', expr, args]));
            }
          }

          break;

        case 'basis.require':
          return ['block'];
      }
    }
  });
}


