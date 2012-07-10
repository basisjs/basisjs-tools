//
// export handler
//

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && (file.deps.length || file.resources.length))
    {
      fconsole.start(file.filename ? file.relpath : '[inline script]');

      relinkScript(file, flowData);

      fconsole.endl();
    }
};

module.exports.handlerName = '[js] Modify basis.resource calls';


//
// main part
//

var at = require('./ast_tools');
var BASIS_RESOURCE = at.normalize('basis.resource');
var BASIS_REQUIRE = at.normalize('basis.require');

function relinkScript(file, flowData){
  file.ast = at.walk(file.ast, {
    "call": function(expr, args){
      switch (at.translate(expr))
      {
        case BASIS_RESOURCE:
          var arg0 = args[0];

          if (arg0[0] == 'string')
          {
            var filename = arg0[1];
            var file = flowData.files.get(filename);

            if (file && file.jsRef)
            {
              var old = at.translate(this);
              arg0[1] = file.jsRef;
              flowData.console.log(old + ' -> ' + at.translate(this));
            }
          }

          break;

        case BASIS_REQUIRE:
          return ['block'];
      }
    }
  });
}


