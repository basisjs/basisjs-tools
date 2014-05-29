require('basis.entity');
require('{=appName}.service');


//
// main part
//

var {=name} = basis.entity.createType('{=name}', {
  id: basis.entity.IntId,
  title: String
});

/* 
{=name}.extend({
  syncAction: {=appName}.service.createAction({
    url: '/api/...',
    success: function(data){
      this.update({=name}.reader(data));
    }
  })
});

{=name}.all.setSyncAction({=appName}.service.createAction({
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
