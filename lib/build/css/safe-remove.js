// Uncomplete handler for safe delete css rules

var at = require('../../ast').css;

//
// export handler
//

module.exports = function(flow){
  var packages = flow.css.packages;
  var fconsole = flow.console;

  // process files in reverse order
  for (var i = packages.length - 1, file; file = packages[i]; i--)
  {
    fconsole.start(file.relOutputFilename);

    if (file.theme)
    {
      var theme = file.theme.replace(/^theme-/, '');
      file.ast = copyAst(file.ast, true);
      at.walk(file.ast, {
        clazz: function(token, parent, stack){
          token = token[2];
          if (token[0].removeFromTheme && Object.prototype.hasOwnProperty.call(token[0].removeFromTheme, theme))
          {
            if (deleteSelector(stack.slice(stack.length - 4).reverse()))
              fconsole.log('YES Delete ' + token[2] + ' (' + theme + ') ' + (token[0].loc || ''));
            else
              fconsole.log('NO Delete ' + token[2] + ' (' + theme + ') ' + (token[0].loc || ''));
          }
        }
      });
    }

    fconsole.endl();
  }
};

function deleteSelector(stack){
  var simpleselector = stack[0];
  var selector = stack[1];
  var rule = stack[2];
  var stylesheet = stack[3];
  var idx;

  idx = selector.indexOf(simpleselector);
  if (idx == -1)
    return false;  // already deleted

  // delete selector from selector group
  selector.splice(idx > 2 ? idx - 1 : idx, 2);

  // if no more selectors
  if (selector.length == 2)
  {
    idx = stylesheet.indexOf(rule);
    if (idx != -1)
    {
      // delete rule from stylesheet
      stylesheet.splice(idx, 1);
      if (stylesheet[idx] && stylesheet[idx][1] == 's')
        stylesheet.splice(idx, 1);
    }
  }

  return true;
}
