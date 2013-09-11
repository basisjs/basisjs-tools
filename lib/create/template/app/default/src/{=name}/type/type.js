basis.require('basis.entity');
basis.require('{=name}.service');

//
// main part
//

var TypeName = basis.entity.createType('TypeName', {
  id: basis.entity.IntId,
  title: String
});

/* 
TypeName.extend({
  syncAction: {=name}.service['default'].createAction({
    url: '/api/...',
    success: function(data){
      this.sync(basis.array(data).map(TypeName.reader));
    }
  })
});

TypeName.all.setSyncAction({=name}.service['default'].createAction({
  url: '/api/...',
  success: function(data){
    this.update(TypeName.reader(data));
  }
}));
*/

//
// export names
//

module.exports = TypeName;
