require('basis.entity');
require('{=name}.service');

//
// main part
//

var TypeName = basis.entity.createType('TypeName', {
  id: basis.entity.IntId,
  title: String
});

/* 
TypeName.extend({
  syncAction: {=name}.service.createAction({
    url: '/api/...',
    success: function(data){
      this.update(TypeName.reader(data));
    }
  })
});

TypeName.all.setSyncAction({=name}.service.createAction({
  url: '/api/...',
  success: function(data){
    this.sync(basis.array(data).map(TypeName.reader));
  }
}));
*/

//
// export names
//

module.exports = TypeName;
