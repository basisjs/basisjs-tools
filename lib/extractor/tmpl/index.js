var js_at = require('../../ast').js;
var path = require('path');

module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;
  var templateModule = flow.tmpl.module;

  if (!templateModule)
  {
    fconsole.log('basis.template is not found');
    fconsole.log('Skiped.');
    return;
  }

  /*console.log(flow.js.globalScope.resolve(['dot', ['dot', ['name', 'basis'], 'template'], 'define']));
  console.log(flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'template']))
  process.exit();*/

  //
  // process tmpl resources
  //

  var implicitDefineSeed = 1;
  var implicitMap = {};
  var implicitDefine = {
    base: {}
  };

  fconsole.start('Check templates and implicit define');
  flow.js.resources.forEach(function(token){
    var file = token.resourceRef;
    if (file.type == 'template')
    {
      var code = js_at.translate(token);
      if (!token.themeDefined)
      {
        var templateGet = js_at.parse('basis.template.get', 1);
        var id;

        if (!implicitMap[file.relpath])
        {
          id = '#' + (implicitDefineSeed++).toString(36);
          implicitMap[file.relpath] = id;
          var resToken = token.slice();
          resToken.ref_ = token.ref_;
          resToken.refPath_ = token.refPath_;
          resToken.resourceRef = token.resourceRef;
          flow.tmpl.themeResources.base[id] = resToken;
          implicitDefine.base[id] = token.resourceRef;
        }
        else
        {
          id = implicitMap[file.relpath];
        }

        token.ref_ = flow.js.globalScope.resolve(templateGet);
        token.refPath_ = 'basis.template.get';
        token[1] = templateGet;
        token[2] = [['string', id]];
        //console.log(token);
        //token.splice(0, token.length, ['call', templateGet, [['string', 'xx']]]);
        fconsole.log(code, '->', js_at.translate(token));
      }
      else
      {
        fconsole.log(code, 'already in theme define');
      }
    }
  });
  fconsole.endl();

  //addImplicitDefine(flow, 'base', implicitBase);

  //
  // process themes
  //

  // collect keys
  var defineKeys = {};
  var themeList = [];
  for (var themeName in flow.tmpl.themes)
  {
    themeList.push(themeName);
    for (var key in flow.tmpl.themeResources[themeName])
      defineKeys[key] = true;
  }

  fconsole.start('Apply template defines');
  for (var themeName in flow.tmpl.themes)
  {
    fconsole.start('theme `' + themeName + '`');
    for (var key in flow.tmpl.themeResources[themeName])
    {
      var resource = flow.tmpl.themeResources[themeName][key];
      if (resource.resourceRef)
      {
        fconsole.log(key, '->', 'basis.resource(\'' + path.relative(flow.options.base, resource.resourceRef.filename) + '\')');
        // replace here because on windows it starts with `C:` or like so,
        // basis.js 1.2+ warn on it
        basis.template.theme(themeName)
          .define(key, basis.resource(resource.resourceRef.filename.replace(/^.*?([\/\\])/, '$1')));
      }
      else
      {
        flow.warn({
          message: 'template source is not a basis.js resource: path `' + key + '` in theme `' + themeName + '`'
        });
      }
    }
    fconsole.endl();
  }
  fconsole.endl();

  //
  // process templates
  //

  fconsole.start('Make template declarations');
  var baseDecl = {};
  for (var themeName in flow.tmpl.themes)
  {
    fconsole.start('theme `' + themeName + '`');
    basis.template.setTheme(themeName);

    if (!implicitDefine[themeName])
      implicitDefine[themeName] = {};

    for (var key in defineKeys)
    {
      var resource = flow.tmpl.themeResources[themeName][key];
      var file = resource && resource.resourceRef;
      var source = basis.template.get(key);
      var decl = basis.template.makeDeclaration(source.get(), path.dirname(source.url) + '/', {
        optimizeSize: flow.options.jsBuildMode
      }, source.url);
      var cmpStr = JSON.stringify(decl.tokens);

      fconsole.start(key + (file ? ': basis.resource("' + file.relpath + '")' : ''));
      if (themeName == 'base')
      {
        // save all base templates in map
        baseDecl[key] = {
          str: cmpStr,
          decl: decl
        };

        // copy warnings to flow
        if (decl.warns)
        {
          decl.warns.forEach(function(warn){
            flow.warn({
              file: file && file.relpath,
              message: warn
            });
          });
        }
      }
      else
      {
        if (resource)
        {
          // copy warnings to flow
          if (decl.warns)
          {
            decl.warns.forEach(function(warn){
              flow.warn({
                file: file && file.relpath,
                message: warn
              });
            });
          }
        }
        else
        {
          // theme has no it's own template source for that path
          // but template may contains inclusion, that can changes theme by themes
          if (cmpStr != baseDecl[key].str)
          {
            // template result has difference with base template -> some inclusion depends on theme
            // create fake file for result, and mark it to store in resource map
            var genericFilename = 'genericTemplate' + (implicitDefineSeed++) + '.tmpl';
            file = flow.files.add({
              jsRefCount: 1,
              type: 'template',
              isResource: true
            });

            // set filename aside, to prevent file manager to read file with that name
            file.filename = genericFilename;

            // add to implicit map
            implicitDefine[themeName][key] = file;

            fconsole.log('[i] add implicit define', genericFilename);
          }
          else
          {
            // declaration the same, just mask all template resource as required in current theme too
            var resources = baseDecl[key].decl.resources;
            if (resources.length)
            {
              for (var j = 0, resourceFilename; resourceFilename = decl.resources[j]; j++)
              {
                var resFile = flow.files.get(resourceFilename);
                if (resFile && resFile.themes)
                  resFile.themes.add(themeName);
              }
            }
          }
        }
      }

      if (file)
      {
        // if file exists, store declaration and link it with resources
        file.decl = decl;
        file.ast = decl.tokens;

        if (decl.resources.length)
        {
          for (var j = 0, resourceFilename; resourceFilename = decl.resources[j]; j++)
          {
            var resFile = flow.files.add({
              filename: resourceFilename, // resource filename already resolved, and should be absolute
              themes: []
            });

            if (resFile.themes) // if file has no themes property, that means css file used by other sources
              resFile.themes.add(themeName);
            else
              resFile.noThemes = true;

            file.link(resFile);
            resFile.isResource = true;
          }
        }
      }
      fconsole.endl();
    }
    fconsole.endl();
  }
  fconsole.endl();

  // inject implicit
  for (var themeName in flow.tmpl.themes)
    addImplicitDefine(flow, themeName, implicitDefine[themeName]);
};

module.exports.handlerName = '[tmpl] Extract';

function addImplicitDefine(flow, themeName, map){
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

    js_at.append(flow.tmpl.module.ast, ['stat', injectCode]);

    Array.prototype.push.apply(flow.tmpl.module.resources, files);
  }
}
