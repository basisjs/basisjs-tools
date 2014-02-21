(module.exports = function(flow){
  var fconsole = flow.console;

  for (var i = 0, file; file = flow.files.queue[i]; i++)
  {
    if (file.type == 'image')
    {
      var validLinks = file.linkBack.filter(function(link){
        console.log(link[1]);
        return link[0].type == 'style' && link[1][1] == 'uri';
      });

      if (validLinks.length == file.linkBack.length)
      {
        for (var j = 0; j < file.linkBack.length; j++)
        {
          file.linkBack[j][1][2].splice(1, 100, 'string', 'data:base64');
          console.log(file.linkBack[j][1]);
        }

        console.log(file.type, file.relpath);
        console.log('OK');
      }
    }
    continue;
  }
}).handlerName = '[res] Inline to base64';
