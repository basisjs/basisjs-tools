var atCss = require('../../ast').css;

module.exports = function(flow){
  var fconsole = flow.console;

  flow.resLinks.forEach(function(link){
    var newValue = link.file.fileRef + link.hash;
    var oldValue;
    var wrapper;

    switch (link.type)
    {
      case 'img-src':
        oldValue = link.host.src;
        wrapper = '<img src="{0}">';

        link.host.src = newValue;
        break;

      case 'link-href':
        oldValue = link.host.href;
        wrapper = '<link href="{0}">';

        link.host.href = newValue;
        break;

      case 'css-url':
        oldValue = atCss.unpackUri(link.token);
        wrapper = 'url({0})';

        atCss.packUri(newValue, link.token);
        break;

      case 'tmpl-src':
        oldValue = link.context.tokenValue(link.token);
        wrapper = link.context.tokenName(link.token) + '="{0}"';

        link.context.tokenValue(link.token, newValue);
        break;

      default:
        flow.warn({
          fatal: true,
          message: 'Unknown link type: ' + link.type
        });
    }

    fconsole.start(link.sourceFile.relpath);
    fconsole.log(wrapper.replace('{0}', oldValue) + ' -> ' + wrapper.replace('{0}', newValue));
    fconsole.endl();
  });
};

module.exports.handlerName = '[res] Relink';
