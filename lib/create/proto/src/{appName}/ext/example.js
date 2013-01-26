
  basis.require('basis.ui.button');

  var SortButton = basis.ui.button.Button.subclass({
  	className: this.name + '.SortButton',
  	click: function(){
  		var target = this.owner || this.parentNode;

  		if (!target)
  			return;

  		target.setSorting(this.sorting, this.sortingDesc);
  		this.sortingDesc = !this.sortingDesc;
  	}
  })

  module.exports = {
  	SortButton: SortButton
  };