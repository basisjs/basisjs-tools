var at = require('../../ast').css;
var at_js = require('../../ast').js;
var html_at = require('../../ast').html;

module.exports = function(flow){
  var fconsole = flow.console;
  var themeUrlsMap = false;

  fconsole.start('Process packages');
  flow.css.packages = flow.css.packages.filter(function(file){
    var outputContent = at.translate(file.ast);
    var isEmpty = !outputContent.length;

    if (isEmpty && !file.themeUrlsMap)
    {
      fconsole.log('[!] ' + file.relOutputFilename + ' is empty - reject');

      // 'cut' token from html
      if (file.htmlNode)
      {
        file.htmlFile.unlink(file, file.htmlNode);
        html_at.removeToken(file.htmlNode, true);
      }
    }
    else
    {
      fconsole.log('[OK] ' + file.relOutputFilename);

      file.outputContent = outputContent;

      if (file.themeUrlsMap)
      {
        themeUrlsMap = file.themeUrlsMap;
        file.themeUrlsMap[file.themeName] = file.relOutputFilename + '?' + file.digest;
        fconsole.log('  add to theme map: ' + file.themeName + ' -> ' + file.themeUrlsMap[file.themeName]);
      }

      if (file.htmlNode)
      {
        if (file.inline && file.htmlId)
        {
          // replace content for <style> with id attribute
          fconsole.log('  replace <style> content for new one');
          file.htmlNode.children[0].data = outputContent;
        }
        else
        {
          // replace html token otherwise
          var attrs = {
            rel: 'stylesheet',
            type: 'text/css',
            id: file.htmlId,
            media: file.media,
            href: file.relOutputFilename + '?' + file.digest
          };

          if (!attrs.id)
            delete attrs.id;

          fconsole.log('  replace <link> href to ' + attrs.href);
          html_at.replaceToken(file.htmlNode, {
            type: 'tag',
            name: 'link',
            children: [],
            attribs: attrs
          });
        }
      }
    }

    return !isEmpty; // keep not empty
  });
  fconsole.endl();

  if (themeUrlsMap)
  {
    var file = flow.indexFile;
    var script = '(' + function(defaultTheme, themeStyles){
      var storage = window.localStorage || {};
      var themeName = defaultTheme || 'base';
      var linkEl = document.getElementById('theme-style');
      try {
        themeName = storage['_basisjs_theme_'] || themeName;
      } catch(e){}
      if (linkEl && themeName in themeStyles)
      {
        linkEl.startupTheme = themeName;
        linkEl.href = themeStyles[themeName];
      }
    } + ')(' + JSON.stringify(flow.options.tmplDefaultTheme) + ', ' + JSON.stringify(themeUrlsMap) + ')';
    var scriptNode = {
      type: 'tag',
      name: 'script',
      attribs: {},
      children: [
        {
          type: 'text',
          data: script
        }
      ]
    };

    html_at.injectToHead(file.ast, {
      type: 'tag',
      name: 'link',
      children: [],
      attribs: {
        rel: 'stylesheet',
        id: 'theme-style'
      }
    });
    html_at.injectToHead(file.ast, scriptNode);

    file.link(flow.files.add({
      type: 'script',
      inline: true,
      htmlFile: file,
      htmlNode: scriptNode,
      baseURI: file.baseURI,
      content: script,
      ast: at_js.parse(script),
      deps: [],
      resources: [],
      throwCodes: []
    }), scriptNode);
  }

  fconsole.start('Process style attributes');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
    if (file.type == 'style-block')
    {
      var outputContent = at.translate(file.ast);
      outputContent = outputContent.substr(1, outputContent.length - 2);

      if (!outputContent.length && file.htmlFile)
      {
        fconsole.log('[!] ' + file.relpath + ' - style is empty, attribute removed');

        if (file.htmlFile)
        {
          var attrs = html_at.getAttrs(file.htmlNode);
          delete attrs.style;
        }
      }
      else
      {
        fconsole.log('[OK] ' + file.relpath + ' - update style attribute');

        if (file.htmlFile)
        {
          var attrs = html_at.getAttrs(file.htmlNode);
          attrs.style = outputContent;
        }

        if (file.tmplFile)
          file.tmplContext.tokenValue(file.tmplToken, outputContent);
      }
    }
  fconsole.end();
};

module.exports.handlerName = '[css] Translate';
