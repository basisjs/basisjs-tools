
basis.require('basis.entity');
basis.require('{=appName}.service');


//
// main part
//

var {=name} = new basis.entity.EntityType({
  name: '{=name}',
  fields: {
    id: basis.entity.IntId,
    title: String
  }
});

 
// {=name}.all.setSyncAction({=appName}.service['default'].createAction({
//   controller: 'type',
//   success: function(data){
//     this.sync(basis.array(data).map({=name}.reader));
//   }
// }));


//
// export names
//

module.exports = {=name};
