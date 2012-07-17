
var path = require('path');

module.exports = function(flowData){
  var files = flowData.files;
  var fconsole = flowData.console;
  var inputDir = flowData.inputDir;
  var processPoint = [];
  var inlineIndex = 0;
  var headNode;

  var ast = flowData.inputFile.ast;

  walkHtml(ast, flowData);

  // insert generic insert point
  flowData.css.genericFile.htmlInsertPoint = {
    type: 'tag',
    name: 'link',
    attribs: {
      rel: 'stylesheet',
      type: 'text/css',
      media: 'all'
    }
  };

  var genericInsertNode = ast;
  if (headNode)
    genericInsertNode = headNode.children || (headNode.children = []);

  genericInsertNode.push(flowData.css.genericFile.htmlInsertPoint);


  //
  // main part
  //

  function resolveFilename(filename){
    return path.resolve(inputDir, filename)
  }

  function getText(node){
    return (node.children && node.children[0] && node.children[0].data) || '';
  }

  function getAttrs(node){
    return node.attribs || {};
  }

  function walkHtml(nodes){

    for (var i = 0, node; node = nodes[i]; i++)
    {
      var file = null;

      switch (node.type)
      {
        case 'script':
          var attrs = getAttrs(node);

          // ignore script with type other than text/javscript
          if (attrs.type && attrs.type != 'text/javascript')
            return;

          // external script
          if (attrs.src)
          {
            var filename = resolveFilename(attrs.src);
            var fileBaseURI = path.dirname(filename);

            if (attrs['basis-config'])
            {
              flowData.js.rootBaseURI.basis = fileBaseURI;
              flowData.js.basisScript = filename;
            }

            fconsole.log('External script found');
            file = files.add({
              source: 'html:script',
              type: 'script',
              filename: filename
            });
          }
          else
          {
            fconsole.log('Inline script found');
            file = files.add({
              source: 'html:script',
              type: 'script',
              inline: true,
              baseURI: inputDir,
              content: getText(node)
            });
          }

          break;

        case 'tag':
          var attrs = getAttrs(node);
          if (node.name == 'link' && attrs.rel == 'stylesheet')
          {
            var filename = resolveFilename(attrs.href);

            fconsole.log('External style found (<link rel="stylesheet">)');
            file = files.add({
              source: 'html:link',
              type: 'style',
              filename: filename,
              media: attrs.media || 'all'
            });
          }

          break;

        case 'style':
          var attrs = getAttrs(node);
          fconsole.log('Inline style found');
          file = files.add({
            source: 'html:style',
            type: 'style',
            baseURI: inputDir,
            inline: true,
            media: attrs.media || 'all',
            content: getText(node)
          });

          break;
      }

      if (file)
      {
        file.htmlInsertPoint = node;

        processPoint.push({
          node: node,
          file: file
        });

        if (file.type == 'style')
          flowData.css.outputFiles.push(file);

        fconsole.log();
      }

      if (node.children)
        walkHtml(node.children);

      // save ref to head node
      if (node.type == 'tag' && node.name == 'head' && !headNode)
        headNode = node;
    }
  }

  if (!flowData.js.basisScript)
  {
    console.warn('Basis.js not found in html');
    process.exit();
  }
}

module.exports.handlerName = '[html] Walk through and collect file references';
