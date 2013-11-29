
var at = require('../../ast').css;
var html_at = require('../../ast').html;

module.exports = function(flow){
  var fconsole = flow.console;

  flow.css.packages = flow.css.packages.filter(function(file){
    var outputContent = at.translate(file.ast);
    var isEmpty = !outputContent.length;

    if (file.rule)
    {
      var attrs = html_at.getAttrs(file.htmlNode);
      outputContent = outputContent.substr(1, outputContent.length - 2);

      if (!outputContent.length)
        delete attrs.style;
      else
        attrs.style = outputContent;

      return false;
    }

    if (isEmpty)
    {
      fconsole.log('[!] ' + file.relOutputFilename + ' is empty - reject');

      // 'cut' token from html
      if (file.htmlNode)
        html_at.removeToken(file.htmlNode, true);
    }
    else
    {
      fconsole.log('[OK] ' + file.relOutputFilename)

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
}

module.exports.handlerName = '[css] Translate';
