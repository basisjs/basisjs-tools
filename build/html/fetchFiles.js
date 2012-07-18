
var at = require('./ast_tools');

module.exports = function(flowData){
  var files = flowData.files;
  var fconsole = flowData.console;
  var inputDir = flowData.inputDir;

  at.walk(flowData.inputFile.ast, function(node){
    var file;

    switch (node.type)
    {
      case 'script':
        var attrs = at.getAttrs(node);

        // ignore <script> tags with type other than text/javascript
        if (attrs.type && attrs.type != 'text/javascript')
        {
          fconsole.log('[!] <script> with type ' + attrs.type + ' ignored');
          return;
        }

        // external script
        if (attrs.src)
        {
          fconsole.log('External script found: <script src="' + attrs.src + '">');

          file = files.add({
            source: 'html:script',
            type: 'script',
            filename: attrs.src
          });

          if (attrs.hasOwnProperty('basis-config'))
          {
            fconsole.log('[i] basis.js marker found (basis-config attribute)');
            file.basisScript = true;
            file.basisConfig = attrs['basis-config'];
          }
        }
        else
        {
          fconsole.log('Inline script found');

          file = files.add({
            source: 'html:script',
            type: 'script',
            inline: true,
            baseURI: inputDir,
            content: at.getText(node)
          });
        }

        break;

      case 'tag':
        var attrs = at.getAttrs(node);
        if (node.name == 'link' && /\bstylesheet\b/i.test(attrs.rel))
        {
          fconsole.log('External style found: <link rel="' + attrs.rel + '">');
          file = files.add({
            source: 'html:link',
            type: 'style',
            filename: attrs.href,
            media: attrs.media || 'all'
          });
        }

        break;

      case 'style':
        var attrs = at.getAttrs(node);

        // ignore <style> with type other than text/css
        if (attrs.type && attrs.type != 'text/css')
        {
          fconsole.log('[!] <style> with type ' + attrs.type + ' ignored');
          return;
        }

        fconsole.log('Inline style found');

        file = files.add({
          source: 'html:style',
          type: 'style',
          baseURI: inputDir,
          inline: true,
          media: attrs.media || 'all',
          content: at.getText(node)
        });

        break;
    }

    if (file)
    {
      file.htmlInsertPoint = node;
      fconsole.log();
    }
  });

}

module.exports.handlerName = '[html] Walk through and collect file references';
