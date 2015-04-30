var js_at = require('../../ast').js;
var path = require('path');
var hasOwnProperty = Object.prototype.hasOwnProperty;

function sortThemes(map){
  var weightMap = {};

  for (var name in map)
  {
    var weight = 1;
    var cursor = name;

    while (cursor != 'base')
    {
      cursor = map[cursor];
      weight++;
    }

    weightMap[name] = weight;
  }

  return Object.keys(weightMap).sort(function(a, b){
    return weightMap[a] - weightMap[b];
  });
}

function correctLoc(loc){
  return {
    line: loc.line - 1,
    column: loc.line - 1
  };
}

function copyWarnsToFlow(warns, knownNestedWarnings, flow, themeName, sourceFilename){
  if (warns)
    warns.forEach(function(warn){
      var filename = sourceFilename;

      if (warn.loc)
      {
        var locFilename = warn.loc.replace(/\:\d+\:\d+$/, '');
        if (locFilename != filename)
        {
          filename = locFilename;

          // filter duplicated
          if (!knownNestedWarnings[filename])
            knownNestedWarnings[filename] = {};

          if (knownNestedWarnings[filename][warn + warn.loc])
            return;

          knownNestedWarnings[filename][warn + warn.loc] = true;
        }
      }

      flow.warn({
        file: filename,
        theme: themeName,
        message: String(warn),
        loc: warn.loc
      });
    });
}


(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;
  var templateModule = flow.tmpl.module;

  /*console.log(flow.js.globalScope.resolve(['dot', ['dot', ['name', 'basis'], 'template'], 'define']));
  console.log(flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'template']))
  process.exit();*/

  //
  // process tmpl resources
  //

  var implicitDefineSeed = 1;
  var implicitMap = {};
  var implicitDefine = flow.tmpl.implicitDefine;
  var themeFallbackMap = {};


  // Temporary solution
  // TODO: rework it
  (function(){
    for (var key in flow.files.preprocess)
      flow.files.preprocess[key].forEach(function(preprocessor){
        if (typeof preprocessor.init == 'function')
          preprocessor.init(flow, basis);
      });
  })();

  fconsole.start('Check templates and implicit define');
  flow.js.resources.forEach(function(token){
    var file = token.resourceRef;
    if (file.type == 'template')
    {
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

        var beforeChanges = js_at.translate(token);
        token.ref_ = flow.js.globalScope.resolve(templateGet);
        token.refPath_ = 'basis.template.get';
        token[1] = templateGet;
        token[2] = [['string', id]];
        //console.log(token);
        //token.splice(0, token.length, ['call', templateGet, [['string', 'xx']]]);
        fconsole.log(beforeChanges, '->', js_at.translate(token));
      }
      else
      {
        fconsole.log(js_at.translate(token), 'already in theme define');
      }
    }
  });
  fconsole.endl();

  //
  // process themes
  //

  // collect keys
  var defineKeys = flow.tmpl.defineKeys;
  for (var themeName in flow.tmpl.themes)
  {
    var themeResources = flow.tmpl.themeResources[themeName];
    for (var key in themeResources)
      defineKeys.add(key);
  }

  fconsole.start('Apply template defines');
  for (var themeName in flow.tmpl.themes)
  {
    fconsole.start('theme `' + themeName + '`');

    var theme = flow.tmpl.themes[themeName];
    var themeResources = flow.tmpl.themeResources[themeName];
    var basisTheme = flow.js.basis.require('basis.template').theme(themeName);

    if (theme.fallback_)
      basisTheme.fallback(theme.fallback_);

    themeFallbackMap[themeName] = theme.fallback_ || 'base';

    for (var key in themeResources)
    {
      var resource = themeResources[key];
      if (resource.resourceRef)
      {
        var filename = resource.resourceRef.filename;
        if (filename)
        {
          basisTheme.define(key, flow.js.basis.resource(filename));

          fconsole.log(key + (filename ? ' -> basis.resource(\'' + filename + '\')' : ' -> virtual resource ' + resource.url));
        }
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

  // sort theme list according to fallback deep
  themeOrdered = sortThemes(themeFallbackMap);


  //
  // process templates
  //

  fconsole.start('Make template declarations');
  var baseDecl = {};
  var knownResources = {};
  var knownNestedWarnings = {};
  var themeOrdered = sortThemes(themeFallbackMap);
  var fallbackDecl = themeOrdered.reduce(function(res, name){
    res[name] = {};
    return res;
  }, {});

  themeOrdered.forEach(function(themeName){
    fconsole.start('theme `' + themeName + '`');
    flow.js.basis.template.setTheme(themeName);

    var themeProcessedResources = [];
    if (!implicitDefine[themeName])
      implicitDefine[themeName] = {};

    for (var defineIdx = 0, key; key = defineKeys[defineIdx]; defineIdx++)
    {
      var source = flow.js.basis.template.get(key);

      // prevent double resource processing as it can produce the same result but with various isolation
      if (typeof source.value == 'object' && !themeProcessedResources.add(source.value))
        continue;

      var resource = flow.tmpl.themeResources[themeName][key];
      var file = resource && resource.resourceRef;
      var decl;
      var hash;

      // find closest fallback decl
      var fallbackTheme = themeName;
      var fallbackHasKey;
      while (fallbackTheme != 'base' && !fallbackDecl[fallbackTheme][key])
        fallbackTheme = themeFallbackMap[fallbackTheme];
      fallbackHasKey = fallbackDecl[fallbackTheme].hasOwnProperty(key);

      // if no resource (implicit define) and no fallback, nothing to do
      if (!resource && !fallbackHasKey)
        continue;

      // main part
      fconsole.start(key + (file ? ': basis.resource("' + file.relpath + '")' : ''));

      // build a declaration
      if (file)
        flow.files.contextFile_ = file.filename;

      decl = flow.js.basis.template.makeDeclaration(source.get(), path.dirname(source.url) + '/', {
        optimizeSize: flow.options.jsCutDev,
        loc: true
      }, source.url.replace(/:.+$/, ''), source);

      // generate declaration hash
      hash = [source.get()]
        .concat(decl.deps.map(function(dep){
          return dep.url || dep;
        }))
        .join('\x00');

      // store result
      if (resource && (!file || !file.usedAsExplicit || !fallbackHasKey))
      {
        fconsole.log('[i] explicit define');

        // reg as fallback
        fallbackDecl[themeName][key] = {
          hash: hash,
          decl: decl,
          file: file
        };

        if (file)
        {
          file.usedAsExplicit = true;
          file.themes = (file.themes || []).concat(themeName);
        }

        // copy warnings to flow
        copyWarnsToFlow(decl.warns, knownNestedWarnings, flow, themeName, file && file.relpath);
      }
      else
      {
        // theme has no it's own template source for that path
        // but template may contains inclusion, that can changes theme by themes
        if (hash != fallbackDecl[fallbackTheme][key].hash)
        {
          // template result has difference with base template -> some inclusion depends on theme
          // create fake file for result, and mark it to store in resource map
          var genericFilename = 'genericTemplate' + (implicitDefineSeed++) + '.tmpl';
          file = flow.files.add({
            jsRefCount: 1,
            generatedFrom: source.url || false,
            generated: true,
            themes: [themeName],
            type: 'template',
            isResource: true
          });
          //console.log(file.filename, '+' + themeName);

          // set filename aside, to prevent file manager to read file with that name
          // filename requires for jsRef generation, and actualy it's a hack
          // TODO: solve the problem
          file.filename = genericFilename;
          file.filename = file.jsRef && null; // generate jsRef

          // add to implicit map
          implicitDefine[themeName][key] = file;

          // add to fallback map
          fallbackDecl[themeName][key] = {
            hash: hash,
            decl: decl,
            file: file
          };

          // copy warnings to flow
          copyWarnsToFlow(decl.warns, knownNestedWarnings, flow, themeName, source.url);

          fconsole.log('[i] implicit define', genericFilename);
        }
        else
        {
          fconsole.log('[i] fallback on `' + fallbackTheme + '` (no define)');

          if (fallbackDecl[fallbackTheme][key].file)
            fallbackDecl[fallbackTheme][key].file.themes.add(themeName);

          // declaration the same, just mask all template resource as required in current theme too
          var resources = fallbackDecl[fallbackTheme][key].decl.resources;
          if (resources.length)
          {
            for (var j = 0, resourceFilename; resourceFilename = resources[j]; j++)
            {
              var resFile = flow.js.basis.resource(resourceFilename).buildFile;
              if (resFile && resFile.themes && resFile.themes.add(themeName))
                fconsole.log('[i] ' + resFile.filename + ' adds `' + themeName + '` to theme list');
            }
          }

          continue;
        }
      }

      var l10nTokens = decl.l10nTokens ? Object.keys(decl.l10nTokens) : [];
      if (l10nTokens.length)
      {
        fconsole.start('[ ] l10n tokens found:');
        fconsole.incDeep(2);
        l10nTokens.forEach(function(path){
          fconsole.log(path);
          // init dictionary
          flow.l10n.getDictionary(path.split('@')[1]);
        });
        fconsole.decDeep(3);
      }

      if (file)
      {
        // if file exists, store declaration and link it with resources
        file.decl = decl;
        file.ast = decl.tokens;
        file.isolate = decl.isolate;
        file.removals = decl.removals;

        if (decl.resources.length)
        {
          var stylesMap = {};

          if (Array.isArray(decl.styles))
            decl.styles.forEach(function(item){
              if (item && item.resource)
                stylesMap[item.resource] = item;
            });

          for (var j = 0, resourceFilename; resourceFilename = decl.resources[j]; j++)
          {
            var resource = flow.js.basis.resource(resourceFilename);
            var resourceSourceUrl = resource().url.replace(/\?.*$/, '');
            var resFile = knownResources[resourceFilename] || flow.files.add(
              resource.virtual  // treat virtual resources as inline
                ? {
                    type: 'style',  // are there possible other kind of resources?
                    inline: true,
                    sourceOffsetMap: resource().map,
                    generatedFrom: resource().url,
                    generated: true,
                    baseURI: resource().baseURI,
                    content: resource().cssText,
                    themes: []
                  }
                : {
                    filename: resourceFilename, // resource filename already resolved, and should be absolute
                    themes: []
                  }
            );

            // to prevent duplicates
            knownResources[resourceFilename] = resFile;

            // set filename for virtual resources to add them to file-graph
            if (resource.virtual && resourceSourceUrl != resource().url)
            {
              resFile.filename = resourceSourceUrl;
              resFile.source = flow.js.basis.resource(resourceSourceUrl).fetch().cssText;
            }

            if (hasOwnProperty.call(stylesMap, resourceFilename))
            {
              var styleInfo = stylesMap[resourceFilename];
              if (styleInfo.constructor === Object)
              {
                resFile.isolate = styleInfo.isolate;

                if (resFile.isolate && !styleInfo.namespace)
                  resFile.originator = file.filename;

                if (styleInfo.inline)
                {
                  var styleToken = styleInfo.styleToken;
                  var text = styleToken.children[0];
                  resFile.embed = {
                    file: styleToken.sourceUrl || file.filename,
                    start: correctLoc(text ? text.loc.start : styleToken.loc.end),
                    end: correctLoc(text ? text.loc.end : styleToken.loc.end)
                  };
                }
              }
            }

            resource.buildFile = resFile;

            // if file has no themes property, that means css file used by other sources
            if (resFile.themes)
            {
              if (resFile.themes.add(themeName))
                fconsole.log('[i] ' + resFile.filename + ' adds `' + themeName + '` to theme list');
            }
            else
            {
              resFile.noThemes = true;
              fconsole.log('[i] mark `' + resFile.filename + '` as not a theme specific');
            }

            file.link(resFile, decl.resources);
            resFile.isResource = true;
          }
        }

        // reset context file
        flow.files.contextFile_ = null;
      }
      fconsole.endl();
    }
    fconsole.endl();
  });
  fconsole.endl();


  //
  // consistent theme sorter
  //
  var themeOrder = themeOrdered.reduce(function(res, theme, idx){
    res[theme] = idx;
    return res;
  }, {});
  flow.tmpl.sortThemes = function(themes){
    return Array.prototype.slice.call(themes).sort(function(a, b){
      return themeOrder[a] - themeOrder[b];
    });
  };
}).handlerName = '[tmpl] Extract';

module.exports.skip = function(flow){
  if (!flow.tmpl.module)
    return 'basis.template is not found';
};
