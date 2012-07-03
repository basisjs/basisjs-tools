
module.exports = function(flowData){
  var queue = flowData.files.queue;

  for (var i = 0; file = queue[i]; i++)
    if (file.type == 'script' && file.htmlInsertPoint)
    {
      console.log(file.relpath, JSON.stringify(file.htmlInsertPoint));
      console.log(file.outputFilename);
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
/*  var points = flowData.htmlProcessPoint;

  for (var i = 0, point; point = points[i]; i++)
  {
    if (point.file.type == 'external script' || point.file.type == 'inline script')
    {
      console.log(JSON.stringify(point.node));
      for (var key in point.node)
        delete point.node[key];

      point.node.data = ' test';
      point.node.type = 'comment';
      console.log(JSON.stringify(point.node));
    }
  }*/
};

module.exports.handlerName = 'Modify <script> entry in html file';