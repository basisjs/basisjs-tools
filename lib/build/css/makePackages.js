
var at = require('../../ast').css;
var html_at = require('../../ast').html;
var js_at = require('../../ast').js;

module.exports = function(flow){
  //
  // build generic style file (style from js & tmpl)
  //

  var fconsole = flow.console;
  var queue = flow.files.queue;
  var htmlFile;
  var styleFileMap = {};
  var targetMap = {};
  var packages = [];
  var multipleThemeBuild = false;

  function putStyle(package, file){
    if (!styleFileMap[package])
      styleFileMap[package] = [];

    styleFileMap[package].push(file);
  }

  //
  // split generic files by package
  //

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'style' && file.isResource)
      if (file.themes && (file.themes.length > 1 || (file.themes.length == 1 && file.themes[0] != 'base')))
      {
        multipleThemeBuild = true;
        break;
      }

  fconsole.log('Style package mode: ' + (multipleThemeBuild ? 'Multiple themes' : 'Single theme') + '\n');

  fconsole.start('Split style by packages');
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'style' && file.isResource)
    {
      if (!multipleThemeBuild || !file.themes)
      {
        fconsole.log(file.relpath, '(all)');
        putStyle('style', file);
      }
      else
      {
        fconsole.log(file.relpath, '[' + file.themes.join(', ') + ']');
        file.themes.forEach(function(themeName){
          putStyle('theme-' + themeName, file);
        });
      }

      continue;
    }

    if (file.type == 'html' && file.ast && !htmlFile)
    {
      htmlFile = file;
    }
  }
  fconsole.endl();  

  //
  // generate package files
  //

  fconsole.start('Create generic files');
  for (var name in styleFileMap)
  {
    fconsole.start(name + '.css');

    var genericStyle = createGenericFile(flow, name, styleFileMap[name], name == 'style' ? {
      type: 'tag',
      name: 'link',
      attribs: {
        rel: 'stylesheet',
        type: 'text/css',
        media: 'all'
      }
    } : null);

    targetMap[name] = true;
    packages.push(genericStyle);
    
    if (name == 'style' && htmlFile)
    {
      fconsole.log('Inject generic file link into html');
      html_at.injectToHead(htmlFile.ast, genericStyle.htmlNode);
      htmlFile.link(genericStyle);
    }

    fconsole.endl();
  }

  if (multipleThemeBuild && flow.tmpl.module)
  {
    var themeUrlsMap = {};
    
    packages.forEach(function(file){
      if (file.theme)
        themeUrlsMap[file.theme.replace(/^theme-/, '')] = file.relOutputFilename + '?' + file.digest;
    });

    flow.files.add({
      jsRef: '_theme_css_',
      type: 'json',
      isResource: true,
      jsResourceContent: themeUrlsMap
    });

    js_at.append(flow.tmpl.module.ast, js_at.parse('(' + function(){
      var linkEl;
      var inDom = false;
      var head;
      onThemeChange(function(name){
        var path = basis.resource('_theme_css_').fetch()[name];
        if (path)
        {
          if (!linkEl)
          {
            linkEl = document.createElement('link');
            linkEl.rel = 'stylesheet';
            linkEl.type = 'text/css';
            linkEl.media = 'all';
            basis.ready(function(){
              head = document.head || document.getElementByTagName('head')[0];
              head.appendChild(linkEl);
            });
          }

          linkEl.href = path;
          if (head && !inDom)
            head.appendChild(linkEl);
        }
        else
        {
          if (inDom && linkEl && linkEl.parentNode)
            linkEl.parentNode.removeChild(linkEl);
        }
      }, null, true);
    } + ')()'));    
  }

  //
  // output files
  //

  flow.css.packages = queue.filter(function(file){
    if (file.type == 'style' && file.htmlNode && !file.outputFilename)
    {
      setOutputFilename(file, this);

      fconsole.log(file.relOutputFilename);

      return file;
    }
  }, targetMap).concat(packages);
};

module.exports.handlerName = '[css] Make packages';

function createGenericFile(flow, name, files, htmlNode){
  var fconsole = flow.console;

  var genericFile = flow.files.add({
    outputFilename: name + '.css',
    type: 'style',
    media: 'all',
    content: '',
    ast: [{}, 'stylesheet'],
    htmlNode: htmlNode
  });

  if (name != 'style')
    genericFile.theme = name;

  genericFile.imports = files.map(function(file, idx){
    fconsole.log(file.relpath);

    this.ast.push(
      at.packComment('placeholder'),
      at.packWhiteSpace('\n')
    );

    return {
      token: this.ast,
      pos: this.ast.length - 2,
      code: '@import url(' + file.filename + ');',
      file: file,
      media: []
    };
  }, genericFile);

  return genericFile;
}

function setOutputFilename(file, targetMap){
  var baseOutputFilename = file.outputFilename || file.name || 'style';
  var idx = 0;
  var outputFilename = baseOutputFilename;

  while (targetMap[outputFilename])
    outputFilename = baseOutputFilename + (++idx);
  targetMap[outputFilename] = true;

  file.outputFilename = outputFilename + '.css';

  return file.outputFilename;
}