
var utils = require('../misc/utils');
var atCss = require('../../ast').css;
var atHtml = require('../../ast').html;
var tmpl_at = require('../../ast').tmpl;

module.exports = function(flow){
  var files = flow.files;
  var queue = flow.files.queue;
  var fconsole = flow.console;

  var urlMap = [];

  for (var i = 0, file; file = queue[i]; i++)
  {
    switch (file.type)
    {
      case 'html':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atHtml.walk(file.ast, {
          'tag': function(node){
            switch (node.name)
            {
              case 'img':
                var attrs = atHtml.getAttrs(node);
                var imageUrl = attrs.src;

                if (imageUrl)
                {
                  fconsole.log('Found <img src="' + imageUrl + '"/>');

                  var imageFile = resolveImage(flow, file, imageUrl);

                  if (imageFile)
                    attrs.src = imageFile.fileRef;
                  else
                    console.log('Image reference ignored (is not resolved)');
                }

                break;

              case 'link':
                if (atHtml.rel(node, 'icon') ||
                    atHtml.rel(node, 'apple-touch-icon') ||
                    atHtml.rel(node, 'apple-touch-icon-precomposed') ||
                    atHtml.rel(node, 'apple-touch-startup-image'))
                {
                  var attrs = atHtml.getAttrs(node);
                  var imageUrl = attrs.href;

                  if (imageUrl)
                  {
                    fconsole.log('Found <link rel="' + atHtml.rel(node).join(' ') + '"/>');

                    var imageFile = resolveImage(flow, file, attrs.href);

                    if (imageFile)
                      attrs.href = imageFile.fileRef;
                    else
                      console.log('Image reference ignored (is not resolved)');
                  }
                }

                break;
            }
          }
        });

        fconsole.endl();
      break;

      case 'style':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        atCss.walk(file.ast, {
          'uri': function(token){
            fconsole.log('Found ' + atCss.translate(token));

            var uri = utils.resolveUri(atCss.unpackUri(token));

            if (uri.filename)
            {
              var imageFile = resolveImage(flow, file, uri.filename);

              if (imageFile)
              {
                imageFile.cssResource = true;
                atCss.packUri(imageFile.fileRef, token);
              }
              else
                console.log('Image reference ignored (is not resolved)');
            }
            /*urlMap.push({
              file: file,
              token: token
            });*/
          }
        });

        fconsole.endl();
      break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.ast)
        {
          tmpl_at.walk(file.ast, {
            'attr': function(token, parentToken){
              switch (this.tokenName(token))
              {
                case 'src':
                  if (this.tokenName(parentToken) == 'img')
                    fconsole.log('Found <img src="' + this.tokenValue(token) + '"/>, but ignored');
                  break;
              }
            }
          });
        }

        fconsole.endl();
      break;
    }
  }
}

module.exports.handlerName = '[res] Extract';

function resolveImage(flow, file, url){
  var imageFile = flow.files.add({
    filename: file.resolve(url)
  });

  if (imageFile)
  {
    file.link(imageFile);

    imageFile.outputFilename = flow.outputResourceDir + imageFile.digest + imageFile.ext;
    imageFile.fileRef = imageFile.relOutputFilename;
    imageFile.outputContent = imageFile.content;
  }

  return imageFile;
}