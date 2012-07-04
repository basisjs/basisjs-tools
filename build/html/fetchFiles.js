
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

  //flowData.htmlProcessPoint = processPoint;


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
            file = {
              source: 'html:script',
              type: 'script',
              filename: filename
            };
          }
          else
          {
            fconsole.log('Inline script found');
            file = {
              source: 'html:script',
              type: 'script',
              inline: true,
              baseURI: inputDir,
              content: getText(node)
            };
          }

          break;

        case 'tag':
          var attrs = getAttrs(node);
          if (node.name == 'link' && attrs.rel == 'stylesheet')
          {
            var filename = resolveFilename(attrs.href);

            fconsole.log('External style found (<link rel="stylesheet">)');
            file = {
              source: 'html:link',
              type: 'style',
              filename: filename,
              media: attrs.media || 'all'
            };
          }

          break;

        case 'style':
          var attrs = getAttrs(node);
          fconsole.log('Inline style found');
          file = {
            source: 'html:style',
            type: 'style',
            baseURI: inputDir,
            inline: true,
            media: attrs.media || 'all',
            content: getText(node)
          };

          break;
      }

      if (file)
      {
        file.htmlInsertPoint = node;
        fconsole.incDeep();
        file = files.add(file);
        fconsole.decDeep();

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
/*    [
  '../../../src/basis/date.js',
  '../../../src/basis/ua.js',
  '../../../src/basis/dom.js',
  '../../../src/basis/event.js',
  '../../../src/basis/data.js',
  '../../../src/basis/data/dataset.js',
  '../../../src/basis/timer.js',
  '../../../src/basis/dom/event.js',
  '../../../src/basis/cssom.js',
  '../../../src/basis/data/property.js',
  '../../../src/basis/data/index.js',
  '../../../src/basis/l10n.js',
  '../../../src/basis/dom/wrapper.js',
  '../../../src/basis/template.js',
  '../../../src/basis/html.js',
  '../../../src/basis/ui.js',
  '../../../src/basis/layout.js',
  '../../../src/basis/dragdrop.js',
  '../../../src/basis/ui/paginator.js',
  'blog.js',
  '../../../src/basis/entity.js'].forEach(function(fn){
    flowData.files.add({filename:resolveFilename(fn)});
  })*/
}

module.exports.handlerName = 'Walk through html tokens and collect files';
