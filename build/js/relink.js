//
// export handler
//

module.exports = function(flowData){
  var queue = flowData.files.queue;
  var fconsole = flowData.console;

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script')
    {
      fconsole.log(file.filename ? file.relpath : '[inline script]');
      fconsole.incDeep();

      relinkScript(file, flowData);

      fconsole.decDeep();
      fconsole.log();
    }
};

module.exports.handlerName = 'Modify basis.resource calls in javascript';


//
// main part
//

var at = require('./ast_tools');
var BASIS_RESOURCE = at.normalize('basis.resource');

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
              console.log(old + ' -> ' + at.translate(this));
            }
          }

          break;
      }
    }
  });
}


