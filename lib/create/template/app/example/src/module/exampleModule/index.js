
  basis.require('basis.ui');
  basis.require('{appName}.type');
  basis.require('{appName}.ext.example')

  module.exports = new basis.ui.Node({
  	dataSource: {appName}.type.ExampleType.all,

  	template: resource('template/list.tmpl'),
  	binding: {
  		button: new {appName}.ext.example.SortButton({
  			caption: 'click me',
  			sorting: function(node){
  				return node.data.name;
  			}
  		})
  	},

  	selection: true,
  	childClass: {
  		template: resource('template/item.tmpl'),
  		binding: {
  			name: 'data:',
  			age: 'data:'
  		},
  		action: {
  			select: function(event){
  				this.select(event.ctrlKey || event.metaKey);
  			}
  		}
  	}
  });