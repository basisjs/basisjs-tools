
var at = require('../../ast').css;
var html_at = require('../../ast').html;

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
  var hasCustomThemes = false;

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
        hasCustomThemes = true;
        break;
      }

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'style' && file.isResource)
    {
      if (!file.themes || !hasCustomThemes)
        putStyle('style', file);
      else
      {
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

  if (hasCustomThemes)
  {
    var themeUrlsMap = {};
    
    packages.forEach(function(file){
      if (file.theme)
      {
        themeUrlsMap[file.theme.replace(/^theme-/, '')] = file.relOutputFilename + '?' + file.digest;
      }
    });

    flow.files.add({
      jsRef: '_theme_css_',
      type: 'json',
      isResource: true,
      jsResourceContent: themeUrlsMap
    });
  }

  //
  // output files
  //

  flow.css.packages = packages.concat(queue.filter(function(file){
    if (file.type == 'style' && file.htmlNode && !file.outputFilename)
    {
      setOutputFilename(file, this);

      fconsole.log(file.relOutputFilename);

      return file;
    }
  }, targetMap));
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