var js_at = require('../../ast/js');

module.exports = function(flow){
  var fconsole = flow.console;
  var queue = flow.files.queue;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'template')
    {
      fconsole.log(file.relpath);
      file.jsResourceContent = file.ast || file.content;
    }
  }

  //
  // inject implicit
  //
  if (flow.tmpl.themeModule)
  {
    fconsole.log();
    fconsole.log('Inject implicit defines in ' + flow.tmpl.themeModule.namespace);
    for (var themeName in flow.tmpl.themes)
    {
      var map = flow.tmpl.implicitDefine[themeName];
      var object = ['object', []];
      var files = [];

      for (var key in map)
      {
        var file = map[key];
        var token = ['call', ['dot', ['name', 'basis'], 'resource'], [['string', file.jsRef]]];

        token.ref_ = flow.js.globalScope.resolve(token[1]);
        token.refPath_ = 'basis.resource';
        token.resourceRef = file;

        object[1].push([key, token]);
        files.push(file);
      }

      if (object[1].length)
      {
        var injectCode = js_at.parse('getTheme().define()')[1];

        injectCode[0][1][1][1][2] = [['string', themeName]];
        injectCode[0][1][2][0] = object;

        js_at.append(flow.tmpl.themeModule.ast, ['stat', injectCode]);

        Array.prototype.push.apply(flow.tmpl.module.resources, files);
      }
    }
  }
};

module.exports.handlerName = '[tmpl] Translate';
