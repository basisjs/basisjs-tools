
module.exports = function(flowData){
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

module.exports.handlerName = 'Modify javascript in html file';