var entity = require('basis.entity');
var service = require('{=name}.service');

//
// main part
//

var TypeName = entity.createType('TypeName', {
  id: entity.IntId,
  title: String
});

/*
TypeName.extendClass({
  syncAction: service.createAction({
    url: '/api/...',
    success: function(data){
      this.update(TypeName.reader(data));
    }
  })
});

TypeName.all.setSyncAction(service.createAction({
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
