var utils = require('../../build/misc/utils');
var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

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
                var uri = resolveUri(attrs.src);

                if (uri)
                {
                  fconsole.log('Found <img src="' + uri.filename + uri.hash + '"/>');

                  var imageFile = resolveImage(flow, file, uri.filename, node);

                  if (imageFile)
                    attrs.src = imageFile.fileRef + uri.hash;
                  else
                    flow.warn({
                      file: this.file.relpath,
                      message: 'Image reference is not resolved (ignored)'
                    });
                }

                break;

              case 'link':
                if (atHtml.rel(node, 'icon') ||
                    atHtml.rel(node, 'apple-touch-icon') ||
                    atHtml.rel(node, 'apple-touch-icon-precomposed') ||
                    atHtml.rel(node, 'apple-touch-startup-image'))
                {
                  var attrs = atHtml.getAttrs(node);
                  var uri = resolveUri(attrs.href);

                  if (uri)
                  {
                    fconsole.log('Found <link rel="' + atHtml.rel(node).join(' ') + '" href="' + uri.filename + uri.hash + '"/>');

                    var imageFile = resolveImage(flow, file, uri.filename, node);

                    if (imageFile)
                      attrs.href = imageFile.fileRef + uri.hash;
                    else
                      flow.warn({
                        file: this.file.relpath,
                        message: 'Image reference is not resolved (ignored)'
                      });
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

            var uri = resolveUri(atCss.unpackUri(token));

            if (uri)
            {
              var imageFile = resolveImage(flow, file, uri.filename, token);

              if (imageFile)
              {
                imageFile.cssResource = true;
                atCss.packUri(imageFile.fileRef + uri.hash, token);
              }
              else
                flow.warn({
                  file: this.file.relpath,
                  message: 'Image reference is not resolved (ignored)'
                });
            }
          }
        });

        fconsole.endl();
      break;

      case 'template':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (file.ast)
        {
          atTmpl.walk(file.ast, {
            'attr': function(token, parentToken){
              switch (this.tokenName(token))
              {
                case 'src':
                  if (this.tokenName(parentToken) == 'img')
                  {
                    fconsole.log('Found <img src="' + this.tokenValue(token) + '"/>');

                    if (this.hasBindings(token))
                    {
                      fconsole.log('[i] Ignored, token has bindings on src attribute');
                      return;
                    }

                    var uri = resolveUri(this.tokenValue(token));

                    if (uri)
                    {
                      var imageFile = resolveImage(flow, file, uri.filename, token);

                      if (imageFile)
                      {
                        imageFile.cssResource = true;
                        this.tokenValue(token, imageFile.fileRef + uri.hash);
                      }
                      else
                        flow.warn({
                          file: this.file.relpath,
                          message: 'Image reference is not resolved (ignored)'
                        });
                    }
                  }
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

function resolveUri(url){
  var uri = utils.resolveUri(url);
  if (uri.filename)
    return uri;
}

function resolveImage(flow, file, url, token){
  var imageFile = flow.files.add({
    filename: file.resolve(url)
  });

  if (imageFile)
  {
    file.link(imageFile, token);

    imageFile.outputFilename = flow.outputResourceDir + imageFile.digest + imageFile.ext;
    imageFile.fileRef = imageFile.relOutputFilename;
    imageFile.outputContent = imageFile.content;
  }

  return imageFile;
}