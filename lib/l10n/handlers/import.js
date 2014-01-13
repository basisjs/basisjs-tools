var path = require('path');
var fs = require('fs');

function unixpath(filename){
  return path.normalize(filename).replace(/\\/g, '/');
}

module.exports = function(flow){
  var fconsole = flow.console;
  var output = {};
  var outputType = 'text';

  if (flow.l10n.version == 2)
  {
    // clear file queue
    fconsole.log('Drop all output files.');
    flow.files.clear();

    fconsole.log('basis.l10n version 2 is not supported yet');
    return;
  }

  switch (flow.options.format)
  {
    case "json":
      break;

    case "po":
    case "gettext":
      var content = fs.readFileSync(flow.options.importFilename, 'utf-8');
      var chunks = content.split(/(?:\r\n?|\n\r?){2,}/);

      for (var i = 0; i < chunks.length; i++)
      {
        var lines = chunks[i].split(/\r\n?|\n\r?/);
        var chunkInfo = {};
        var special = true;
        var type;
        var content;

        for (var j = 0; j < lines.length; j++)
        {
          var line = lines[j];
          if (special)
          {
            if (line.charAt(0) == '#')
            {
              type = line.charAt(1);
              content = line.substr(2).trim();
            }
            else
            {
              j--;
            }
          }

          if (type in chunkInfo)
          {
            typeInfo = (chunkInfo[type] || chunkInfo[type] = []);
          }
        }
        console.log('>>', chunk);
      }

      break;

    default:
      flow.warn({
        fatal: true,
        message: 'Format `' + flow.options.format + '` is not support for import'
      });
  }

  // clear file queue
  fconsole.log('Drop all output files.');
  flow.files.clear();

  // for (var culture in output)
  // {
  //   var file = flow.files.add({
  //     type: outputType,
  //     outputFilename: output[culture].filename,
  //     outputContent: output[culture].content
  //   });
  // }
};

module.exports.handlerName = '[l10n] Import';
