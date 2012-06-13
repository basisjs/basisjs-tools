
var path = require('path');

module.exports = function(flowData){

  function getText(node){
    return (node.children && node.children[0] && node.children[0].data) || '';
  }

  function getAttrs(node){
    return node.attribs || {};
  }

  function walk(nodes){
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
            var filename = path.resolve(flowData.baseURI, attrs.src);

            if(attrs['basis-config'])
              flowData.js.base.basis = path.dirname(filename);

            console.log('[JS] ' + filename);
            file = {
              source: 'html:script',
              type: 'script',
              filename: filename
            };
          }
          else
          {
            console.log('[JS] inline');
            file = {
              source: 'html:script',
              type: 'script',
              inline: true,
              content: getText(node)
            };
          }

          break;

        case 'style':
          console.log('[CSS] inline');
          file = {
            source: 'html:style',
            type: 'style',
            inline: true,
            content: getText(node)
          };

          break;

        case 'tag':
          var attrs = getAttrs(node);
          if (node.name == 'link' && attrs.rel == 'stylesheet')
          {
            var filename = path.resolve(flowData.baseURI, attrs.href);

            console.log('[CSS] ' + filename);
            file = {
              source: 'html:link',
              type: 'style',
              filename: filename
            };
          }
          break;
      }

      if (file)
      {
        files.add(file);

        processPoint.push({
          node: node,
          file: file
        });
      }

      if (node.children)
        walk(node.children);
    }
  }

  var processPoint = [];
  var files = flowData.files;

  walk(flowData.htmlTokens);

  flowData.htmlProcessPoint = processPoint;
}

module.exports.handlerName = 'Walk through dom and collect files';

