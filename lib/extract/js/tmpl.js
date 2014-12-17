var at = require('../../ast').js;

module.exports = function(file, flow, defineHandler){
  var fconsole = flow.console;

  flow.tmpl.themeModule = file;

  var getTheme = function(name){
    if (!name)
      name = 'base';

    if (flow.tmpl.themes[name])
      return flow.tmpl.themes[name];

    var fn = function(name){
      return at.createRunner(function(token, this_, args){
        fconsole.log('[basis.template] template#' + name + ' call', args);
      });
    };

    function addSource(key, value){
      fconsole.log('[basis.template] define template `' + key + '` in `' + theme.name + '` theme');
      resources[key] = value;
      if (value[0] == 'call' && value.resourceRef)
        value.themeDefined = true;
      return value;
    }

    var resources = {};
    var theme = {
      name: name,
      fallback: fn('fallback'),
      define: at.createRunner(function(token, this_, args){
        //fconsole.log('define', args);
        if (!args.length || !args[0])
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: ['basis.template.define w/o args', args]
          });

        var what = this.scope.simpleExpression(args[0]);
        var by = args[1] ? this.scope.simpleExpression(args[1]) : null;

        //fconsole.log('define', what, by);
        if (!what && args[0])
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: 'basis.template.define: first parameter is not resolved, token: ' + at.translate(token)
          });

        if (!by && args[1])
          return flow.warn({
            fatal: true,
            file: this.file.relpath,
            message: 'basis.template.define: second parameter is not resolved, token: ' + at.translate(token)
          });

        if (what[0] == 'string')
        {
          if (!by || by[0] != 'object')
          {
            if (!by || args.length == 1)
            {
              // return getSourceByPath(what);
            }
            else
            {
              return addSource(what[1], by);
            }
          }
          else
          {
            var namespace = what[1];
            var props = by[1];
            var result = ['object', []];
            result.obj = {};

            for (var i = 0; i < props.length; i++)
              result.obj[namespace + '.' + props[i][0]] = addSource(namespace + '.' + props[i][0], props[i][1]);

            return result;
          }
        }
        else
        {
          if (what[0] == 'object')
          {
            var props = what[1];

            for (var i = 0; i < props.length; i++)
              addSource(props[i][0], props[i][1]);

             return theme;
          }
          else
          {
            flow.warn({
              file: this.file.relpath,
              message: 'Wrong first argument for basis.template.Theme#define'
            });
          }
        }
      }),
      apply: fn('apply'),
      getSource: fn('getSource'),
      drop: at.createRunner(function(token, this_, args){
        flow.warn({
          file: this.file.relpath,
          message: 'basis.template.theme#drop should never be called in build'
        });
      })
    };

    flow.tmpl.themes[name] = theme;
    flow.tmpl.themeResources[name] = resources;

    return theme;
  };

  getTheme('base');

  // basis.template.theme
  defineHandler(file.jsScope, 'getTheme', function(token, this_, args){
    //fconsole.log('getTheme');
    var name = args[0] && args[0][0] == 'string' ? args[0][1] : '';
    token.obj = getTheme(name);
  });
};
