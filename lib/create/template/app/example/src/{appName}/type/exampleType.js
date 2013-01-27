
  basis.require('basis.entity');
  basis.require('{appName}.service');


  //
  // main part
  //

  var ExampleType = new basis.entity.EntityType({
  	name: 'ExampleType',
  	fields: {
  		id: basis.entity.IntId,
  		name: String,
  		age: Number
  	}
  });

  ExampleType.all.setSyncAction({appName}.service['default'].createAction({
  	controller: 'someType',
  	success: function(data){
  		this.sync(basis.array(data).map(ExampleType.reader));
  	}
  }));


  //
  // export names
  //

  module.exports = ExampleType;
