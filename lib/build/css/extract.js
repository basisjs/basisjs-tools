
var html_at = require('../html/ast_tools');

module.exports = function(flow){

  var fconsole = flow.console;
  var queue = flow.files.queue;

  //
  // Scan html files for styles
  //

  fconsole.start('Scan html files for styles');

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html' && file.ast)
    {
      fconsole.start(file.relpath);

      html_at.walk(file.ast, {
        tag: function(node){
          switch (node.name)
          {
            case 'link':
              var attrs = html_at.getAttrs(node);
              if (/\bstylesheet\b/i.test(attrs.rel))
              {
                // <link rel="stylesheet">');
                fconsole.log('External style found: ' + html_at.translate(node));

                var styleLinkFile = flow.files.add({
                  type: 'style',
                  filename: file.resolve(attrs.href),
                  media: attrs.media || 'all',
                  htmlNode: node
                });

                if (styleLinkFile)
                  file.link(styleLinkFile);
              }

              break;

            case 'style':
              var attrs = html_at.getAttrs(node);

              // ignore <style> with type other than text/css
              if (attrs.type && attrs.type != 'text/css')
              {
                fconsole.log('[!] <style> with type ' + attrs.type + ' ignored');
                return;
              }

              // <style> or <style type="text/css">
              fconsole.log('Inline style found');

              file.link(flow.files.add({
                type: 'style',
                baseURI: file.baseURI,
                inline: true,
                media: attrs.media || 'all',
                htmlNode: node,
                content: html_at.getText(node)
              }));

              break;

            default:
              var attrs = html_at.getAttrs(node);
              if (attrs.style)
              {
                file.link(flow.files.add({
                  type: 'style',
                  baseURI: file.baseURI,
                  inline: true,
                  rule: true,
                  htmlNode: node,
                  content: attrs.style
                }));
              }
          }
        }
      });

      fconsole.endl();
    }
  }
  fconsole.endl();


  //
  // Search for styles files in html
  //

  fconsole.log('Prepare output files');
  var outputFiles = queue.filter(function(file){
    return file.type == 'style' && file.htmlNode && !file.rule;
  });

  fconsole.log();


  //
  // Search for style in html
  //

  fconsole.start('Process styles');
  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.type == 'style')
    {
      fconsole.start(file.relpath);
      processFile(file, flow);
      fconsole.endl();
    }
  }
  fconsole.endl();


  //
  // Save result in flow
  //

  flow.css = {
    outputFiles: outputFiles
  };

};

module.exports.handlerName = '[css] Extract';


//
// Main part: file process
//

var csso = require('csso');
var utils = require('../misc/utils');
var at = require('./ast_tools');

function processFile(file, flow){
  var fconsole = flow.console;

  // import tokens
  file.imports = [];

  // parse css into tree
  if (file.rule)
    file.ast = csso.parse('{' + file.content + '}', 'block', true);
  else
    file.ast = csso.parse(file.content, 'stylesheet', true);

  // search and extract css files
  at.walk(file.ast, {
    'atrules': function(token, parentToken){
      // @import
      if (token[2][1] == 'atkeyword' && token[2][2][1] == 'ident' && token[2][2][2] == 'import')
      {
        var parts = token.slice(3);

        if (parts[0][1] == 's')
          parts.shift();

        var firstArg = parts.shift();
        var uri = utils.resolveUri(
          firstArg[1] == 'uri'
            ? at.unpackUri(firstArg)
            : at.unpackString(firstArg[2])
        );

        // ignore externals
        if (uri.url)
          return;

        // resolve import file
        var importFile = flow.files.add(
          uri.filename
            ? {
                filename: file.resolve(uri.filename)
              }
            : {
                type: 'style',
                baseURI: file.baseURI,
                content: uri.content
              }
        );

        // resolve media
        var media = parts;
        if (media[0] && media[0][1] != 's')
          media.unshift(at.packWhiteSpace(' '));

        // add link
        file.link(importFile);

        // add import
        file.imports.push({
          token: parentToken,
          pos: parentToken.indexOf(token),
          code: at.translate(token),
          file: importFile,
          media: media.filter(at.wsFilter).length ? media : []
        });
      }
    }
  });
}