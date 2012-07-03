
module.exports = function(flowData){
  var fconsole = flowData.console;
  var queue = flowData.files.queue;

  for (var i = 0; file = queue[i]; i++)
    if (file.type == 'script' && file.htmlInsertPoint)
    {
      fconsole.log(file.relpath);
      if (file.outputFilename)
      {
        flowData.html.replaceToken(file.htmlInsertPoint, {
          type: 'script',
          name: 'script',
          attribs: {
            type: 'text/javascript',
            src: file.relOutputFilename + '?' + file.digest
          }
        });
      }
      else
      {
        flowData.html.replaceToken(file.htmlInsertPoint, 
          file.outputContent
            ? {
                type: 'script',
                name: 'script',
                attribs: {
                  type: 'text/javascript'
                },
                children: [
                  {
                    type: 'text',
                    data: file.outputContent
                  }
                ]
              }
            : {
                type: 'text',
                data: ''
              }
        );
      }
    }
};

module.exports.handlerName = 'Modify <script> entry in html file';