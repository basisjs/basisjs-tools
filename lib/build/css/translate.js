var at = require('../../ast').css;
var html_at = require('../../ast').html;

module.exports = function(flow){
  var fconsole = flow.console;

  fconsole.start('Process packages');
  flow.css.packages = flow.css.packages.filter(function(file){
    var outputContent = at.translate(file.ast);
    var isEmpty = !outputContent.length;

    if (isEmpty)
    {
      fconsole.log('[!] ' + file.relOutputFilename + ' is empty - reject');

      // 'cut' token from html
      if (file.htmlNode)
        html_at.removeToken(file.htmlNode, true);
    }
    else
    {
      fconsole.log('[OK] ' + file.relOutputFilename);

      file.outputContent = outputContent;

      // replace token in html
      if (file.htmlNode)
        html_at.replaceToken(file.htmlNode, {
          type: 'tag',
          name: 'link',
          children: [],
          attribs: {
            rel: 'stylesheet',
            type: 'text/css',
            media: file.media,
            href: file.relOutputFilename + '?' + file.digest
          }
        });
    }

    return !isEmpty; // keep not empty
  });
  fconsole.endl();

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
        {
          console.log(JSON.stringify(file.tmplToken));
          file.tmplContext.tokenValue(file.tmplToken, outputContent);
          console.log(JSON.stringify(file.tmplToken));
        }
      }
    }
  fconsole.end();
};

module.exports.handlerName = '[css] Translate';
