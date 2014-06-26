var Service = require('basis.net.service').Service;

var defaultService = new Service({
  // transportClass: basis.net.ajax.Transport.subclass({
  //   init: function(){
  //     this.url = '/api/' + this.controller;
  //     basis.net.ajax.Transport.prototype.init.call(this);
  //   }
  // })
});

module.exports = defaultService;
