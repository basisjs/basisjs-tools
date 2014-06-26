var entity = require('basis.entity');
var service = require('{=appName}.service');

//
// main part
//

var {=name} = entity.createType('{=name}', {
  id: entity.IntId,
  title: String
});

/* 
{=name}.extendClass({
  syncAction: service.createAction({
    url: '/api/...',
    success: function(data){
      this.update({=name}.reader(data));
    }
  })
});

{=name}.all.setSyncAction(service.createAction({
  url: '/api/...',
  success: function(data){
    this.sync(basis.array(data).map({=name}.reader));
  }
}));
*/

//
// export names
//

module.exports = {=name};
