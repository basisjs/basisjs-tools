
basis.require('basis.entity');
basis.require('{=appName}.service');


//
// main part
//

var {=name} = new basis.entity.Entity{=name}({
  name: '{=name}',
  fields: {
    id: basis.entity.IntId,
    title: String
  }
});

 
// {=name}.all.setSyncAction({=name}.service['default'].createAction({
//   controller: 'type',
//   success: function(data){
//     this.sync(basis.array(data).map({=name}.reader));
//   }
// }));


//
// export names
//

module.exports = {=name};
