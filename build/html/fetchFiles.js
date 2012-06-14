
var path = require('path');

module.exports = function(flowData){
  var files = flowData.files;
  var owner = flowData.buildFile;
  var baseURI = flowData.baseURI;
  var processPoint = [];
  var inlineIndex = 0;
  var headNode;

  walkHtml(flowData.html.ast, flowData);

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

  if (headNode)
    genericInsertNode = headNode.children || (headNode.children = []);
  else
    genericInsertNode = flowData.html.ast;

  genericInsertNode.push(flowData.css.genericFile.htmlInsertPoint);

  //flowData.htmlProcessPoint = processPoint;


  //
  // main part
  //

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
            var filename = path.resolve(baseURI, attrs.src);
            var fileBaseURI = path.dirname(filename);

            if(attrs['basis-config'])
            {
              flowData.js.base.basis = fileBaseURI;
              flowData.js.basisScript = filename;
            }

            console.log('[JS] ' + filename);
            file = {
              source: 'html:script',
              type: 'script',
              filename: filename,
              baseURI: fileBaseURI
            };
          }
          else
          {
            console.log('[JS] inline');
            file = {
              source: 'html:script',
              type: 'script',
              inline: true,
              baseURI: baseURI,
              content: getText(node)
            };
          }

          break;

        case 'tag':
          var attrs = getAttrs(node);
          if (node.name == 'link' && attrs.rel == 'stylesheet')
          {
            var filename = path.resolve(baseURI, attrs.href);

            console.log('[CSS] ' + filename);
            file = {
              source: 'html:link',
              type: 'style',
              filename: filename,
              baseURI: path.dirname(filename),
              owner: filename,
              media: attrs.media || 'all'
            };
          }

          break;

        case 'style':
          console.log('[CSS] inline');
          file = {
            source: 'html:style',
            type: 'style',
            baseURI: baseURI,
            outputFilename: '_inline',
            inline: true,
            media: attrs.media || 'all',
            content: getText(node)
          };

          break;
      }

      if (file)
      {
        file.htmlInsertPoint = node;
        file = files.add(file);

        processPoint.push({
          node: node,
          file: file
        });

        if (file.type == 'style')
          flowData.css.outputFiles.push(file);
      }

      if (node.children)
        walkHtml(node.children);

      // save ref to head node
      if (node.type == 'tag' && node.name == 'head' && !headNode)
        headNode = node;
    }
  }
}

module.exports.handlerName = 'Walk through html tokens and collect files';
