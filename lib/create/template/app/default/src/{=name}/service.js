basis.require('basis.net.service');

var defaultService = new basis.net.service.Service({
  // transportClass: basis.net.Transport.subclass({
  //   init: function(){
  //     this.url = '/api/' + this.controller;
  //     basis.net.Transport.prototype.init.call(this);
  //   }
  // })
});

module.exports = {
  'default': defaultService
};