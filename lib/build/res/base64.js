var mime = require('mime');

function unsupportedLink(link){
  return (link[0].type != 'style' && link[0].type != 'style-block') ||
         link[1][1] != 'uri';
};

(module.exports = function(flow){
  var fconsole = flow.console;
  var quota = flow.options.cssInlineImage;

  for (var i = flow.files.queue.length - 1, file; file = flow.files.queue[i]; i--)
  {
    if (file.type == 'image')
    {
      fconsole.start(file.relpath);

      if (file.content.length > quota)
      {
        fconsole.endl('[skip] Too big (more than ' + quota + ' bytes)');
        continue;
      }

      if (file.linkBack.some(unsupportedLink))
      {
        fconsole.endl('[skip] Has non-css or not url() references');
        continue;
      }

      //
      // inline
      //

      var fileBase64Content = new Buffer(file.content, 'binary').toString('base64');
      var mimeType = mime.lookup(file.relpath);

      // replace refences
      fconsole.start('Replace references in css');
      for (var j = 0; j < file.linkBack.length; j++)
      {
        var cssToken = file.linkBack[j][1][2];

        fconsole.log(file.linkBack[j][0].relpath);
        cssToken.splice(1, cssToken.length,
          'string',
          'data:' + mimeType + ';base64,' + fileBase64Content);
      }
      fconsole.end();

      // remove from output
      fconsole.log('Remove file from output');
      flow.files.remove(file);

      // end
      fconsole.endl();
    }
  }

}).handlerName = '[res] Inline to base64';

module.exports.skip = function(flow){
  var quota = flow.options.cssInlineImage;

  if (isNaN(quota) || quota <= 0)
    return 'Use option --css-inline-image to set max size of image to be inlined';
};
