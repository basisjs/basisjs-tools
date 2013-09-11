basis.require('basis.entity');
basis.require('{=appName}.service');


//
// main part
//

var {=name} = basis.entity.createType('{=name}', {
  id: basis.entity.IntId,
  title: String
});

/* 
{=name}.extend({
  syncAction: {=name}.service['default'].createAction({
    url: '/api/...',
    success: function(data){
      this.sync(basis.array(data).map({=name}.reader));
    }
  })
});

{=name}.all.setSyncAction({=name}.service['default'].createAction({
  url: '/api/...',
  success: function(data){
    this.update({=name}.reader(data));
  }
}));
*/

//
// export names
//

module.exports = {=name};
