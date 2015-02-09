var utils = require('../../build/misc/utils');
var html = require('../html');
var atHtml = require('../../ast').html;
var atCss = require('../../ast').css;
var atTmpl = require('../../ast').tmpl;

module.exports = function(flow){
  var files = flow.files;
  var queue = flow.files.queue;
  var fconsole = flow.console;

  flow.resLinks = [];

  for (var i = 0, file; file = queue[i]; i++)
  {
    switch (file.type)
    {
      case 'html':
        fconsole.start('Scan (' + file.type + ') ' + file.relpath);

        if (!file.ast)
          html.processFile(file, flow);

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
                    //attrs.src = imageFile.fileRef + uri.hash;
                    flow.resLinks.push({
                      type: 'img-src',
                      sourceFile: file,
                      file: imageFile,
                      hash: uri.hash,
                      host: attrs
                    });
                  else
                    flow.warn({
                      file: file.relpath,
                      message: 'Image reference is not resolved (ignored)'
                    });
                }

                break;

              case 'link':
                var attrs = atHtml.getAttrs(node);

                if (/^image\//.test(attrs.type) ||
                    atHtml.rel(node, 'icon') ||
                    atHtml.rel(node, 'apple-touch-icon') ||
                    atHtml.rel(node, 'apple-touch-icon-precomposed') ||
                    atHtml.rel(node, 'apple-touch-startup-image'))
                {
                  var uri = resolveUri(attrs.href);

                  if (uri)
                  {
                    fconsole.log('Found <link rel="' + atHtml.rel(node).join(' ') + '" href="' + uri.filename + uri.hash + '"/>');

                    var imageFile = resolveImage(flow, file, uri.filename, node);

                    if (imageFile)
                      //attrs.href = imageFile.fileRef + uri.hash;
                      flow.resLinks.push({
                        type: 'link-href',
                        sourceFile: file,
                        file: imageFile,
                        hash: uri.hash,
                        host: attrs
                      });
                    else
                      flow.warn({
                        file: file.relpath,
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
      case 'style-block':
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
                //atCss.packUri(imageFile.fileRef + uri.hash, token);
                flow.resLinks.push({
                  type: 'css-url',
                  sourceFile: file,
                  file: imageFile,
                  hash: uri.hash,
                  token: token
                });
              }
              else
                flow.warn({
                  file: file.relpath,
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
          atTmpl.walk(file.ast, flow.js.basis.template, {
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
                      var imageFile = resolveImage(flow, file, uri.filename, token, flow.indexFile);

                      if (imageFile)
                      {
                        imageFile.cssResource = true;
                        //this.tokenValue(token, imageFile.fileRef + uri.hash);
                        flow.resLinks.push({
                          type: 'tmpl-src',
                          sourceFile: file,
                          file: imageFile,
                          hash: uri.hash,
                          token: token,
                          context: this
                        });
                      }
                      else
                      {
                        flow.warn({
                          file: file.relpath,
                          message: 'Image reference is not resolved (ignored)'
                        });
                      }
                    }
                  }
                  break;
                case 'style':
                  if (!/^b:/.test(this.tokenName(parentToken)) && this.tokenValue(token))
                  {
                    fconsole.log('Style attribute found');
                    file.link(flow.files.add({
                      type: 'style-block',
                      inline: true,
                      tmplFile: file,
                      tmplToken: token,
                      tmplContext: this,
                      baseURI: flow.indexFile.baseURI,
                      content: this.tokenValue(token),
                      ast: atCss.parse(this.tokenValue(token), true)
                    }), token);
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
};

module.exports.handlerName = '[res] Extract';

function resolveUri(url){
  var uri = utils.resolveUri(url);
  if (uri.filename)
    return uri;
}

function resolveImage(flow, file, url, token, baseFile){
  var imageFile = flow.files.add({
    filename: (baseFile || file).resolve(url)
  });

  if (imageFile)
  {
    file.link(imageFile, token);
    imageFile.output = true;
  }

  return imageFile;
}
