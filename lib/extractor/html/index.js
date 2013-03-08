var at = require('../../ast').html;
var utils = require('../../build/misc/utils');

var NON_WHITESPACE = /[^\s\r\n]/;

(module.exports = function(flow){
  var queue = flow.files.queue;
  var fconsole = flow.console;

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.start(file.relpath);

      processFile(file, flow);

      fconsole.endl();
    }
  }
}).handlerName = '[html] Extract';

//
// Main part, process files
//

function processFile(file, flow){
  var fconsole = flow.console;
  var scriptSequenceId = 0;
  var jsSequence = false;
  var head;
  var body;

  // get ast
  var ast = at.parse(file.content);

  // debug output
  //console.log(require('util').inspect(ast, false, null));

  at.walk(ast, {
    '*': function(node){
      // nothing to do if text node contains whitespace only
      if (node.type == 'text' && !NON_WHITESPACE.test(node.data))
        return;

      // scripts with src continue script sequence
      if (node.type == 'tag' && node.name == 'script')
        return;

      scriptSequenceId += jsSequence;
      jsSequence = false;
    },
    tag: function(node){
      var attrs = at.getAttrs(node);

      switch (node.name)
      {
        case 'head':
          if (!head)
          {
            fconsole.log('<head> tag found (store reference)');
            head = node;
          }
          else
          {
            fconsole.log('[!] more than one <head> tag is prohibited (ignore)');
          }

          break;

        case 'body':
          if (!body)
          {
            fconsole.log('<body> tag found (store reference)');
            body = node;
          }
          else
          {
            fconsole.log('[!] more than one <body> tag is prohibited (ignore)');
          }

          break;

        case 'script':
          // ignore <script> tags with type other than text/javascript
          if (attrs.type && attrs.type != 'text/javascript')
          {
            fconsole.log('[!] <script> with unknown type `' + attrs.type + '` ignored\n');
            return;
          }

          // external script
          if (attrs.src)
          {
            var uri = utils.resolveUri(attrs.src);

            if (uri.filename)
            {
              fconsole.start('External script found: <script src="' + attrs.src + '">');
              jsSequence = true;

              var scriptFile = flow.files.add({
                htmlFile: file,
                htmlNode: node,
                type: 'script',
                filename: file.resolve(attrs.src),
                package: 'script' + (scriptSequenceId || '')
              });

              if (!scriptFile)
                return;

              file.link(scriptFile, node);

              fconsole.endl();
            }
            else if (uri.mime == 'text/javascript')
            {
              fconsole.start('Inline script with data uri found');
              jsSequence = true;

              var scriptFile = flow.files.add({
                htmlNode: node,
                type: 'script',
                inline: true,
                baseURI: file.baseURI,
                content: uri.content,
                package: 'script' + (scriptSequenceId || '')
              });

              if (attrs['build-filename'])
                scriptFile.sourceFilename = attrs['build-filename'];

              file.link(scriptFile, node);

              fconsole.endl();
            }
            else
            {
              fconsole.log('[!] script ignored: ' + at.translate(node) + '\n');
            }
          }
          else
          {
            fconsole.log('Inline script found\n');

            file.link(flow.files.add({
              htmlNode: node,
              type: 'script',
              inline: true,
              baseURI: file.baseURI,
              content: at.getText(node)
            }), node);
          }

          break;        

        //
        // style
        //
        case 'link':

          if (at.rel(node, 'stylesheet'))
          {
            // <link rel="stylesheet">');
            fconsole.log('External style found: ' + at.translate(node));

            var styleLinkFile = flow.files.add({
              type: 'style',
              filename: file.resolve(attrs.href),
              media: attrs.media || 'all',
              htmlNode: node
            });

            if (styleLinkFile)
              file.link(styleLinkFile, node);
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

          // <style> or <style type="text/css">
          fconsole.log('Inline style found');

          var styleFile = flow.files.add({
            type: 'style',
            baseURI: file.baseURI,
            inline: true,
            media: attrs.media || 'all',
            htmlNode: node,
            content: at.getText(node)
          });

          if (attrs['build-filename'])
            styleFile.sourceFilename = attrs['build-filename'];

          file.link(styleFile, node);

          break;

        default:
          var attrs = at.getAttrs(node);
          if (attrs.style)
          {
            file.link(flow.files.add({
              type: 'style',
              baseURI: file.baseURI,
              inline: true,
              rule: true,
              htmlNode: node,
              content: attrs.style
            }), node);
          }
      }
    }
  });

  ast.head = head || ast;
  ast.body = body || ast;

  // save result in file
  file.ast = ast;
}
