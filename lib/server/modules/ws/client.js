;(function(global){
  var console = global.console;

  if (typeof console == 'undefined')
    console = {
      log: function(){},
      warn: function(){},
      error: function(){}
    };


  //
  // Token
  //

 /**
  * @class
  */
  var Token = function(value){
    this.value = value;
  };

  Token.prototype = {
    handler: null,

   /**
    * Set new value for token. Call apply method if value has been changed.
    * @param {*} value
    */
    set: function(value){
      if (this.value !== value)
      {
        this.value = value;
        this.apply();
      }
    },

   /**
    * Add callback on token value changes.
    * @param {function(value)} fn
    * @param {object=} context
    */
    attach: function(fn, context){
      var cursor = this;
      while (cursor = cursor.handler)
        if (cursor.fn === fn && cursor.context === context)
          console.warn('duplicate fn & context pair');

      this.handler = {
        fn: fn,
        context: context,
        handler: this.handler
      };
    },

   /**
    * Remove callback. Must be passed the same arguments as for {basis.Token#attach} method.
    * @param {function(value)} fn
    * @param {object=} context
    */
    detach: function(fn, context){
      var cursor = this;
      var prev;

      while (prev = cursor, cursor = cursor.handler)
        if (cursor.fn === fn && cursor.context === context)
        {
          // make it non-callable
          cursor.fn = function(){};

          // remove from list
          prev.handler = cursor.handler;

          return;
        }

      console.warn('fn & context pair not found, nothing was removed');
    },

   /**
    * Call every attached callbacks with current token value.
    */
    apply: function(){
      var cursor = this;

      while (cursor = cursor.handler)
        cursor.fn.call(cursor.context, this.value);
    }
  };

  //
  // main API
  //

  var socket = io.connect('', { transports: ['websocket', 'polling'] });
  var sendToServer = function(){
    socket.emit.apply(socket, arguments);
  };
  var api = {
    getAppProfile: function(callback){
      sendToServer('getAppProfile', location.href, callback);
    },
    getBundle: function(config, callback){
      sendToServer('getBundle', config || location.href, callback);
    }
  };


  //
  // notifications
  //

  api.notifications = new Token;
  api.notifications.apply = function(){
    var cursor = this;

    while (cursor = cursor.handler)
      cursor.fn.apply(cursor.context, this.value);
  };


  //
  // online
  //

  api.isOnline = new Token(false);
  socket
    .on('connect', function(){
      api.isOnline.set(true);
    })
    .on('disconnect', function(){
      api.isOnline.set(false);
    });


  //
  // features
  //

  api.features = new Token([]);
  socket
    .on('features', function(features){
      api.features.set(features);
    })
    .on('disconnect', function(){
      api.features.set([]);
    });


  //
  // modules
  //
  // <!--inject-->


  // export to global
  global.socket = socket;
  global.basisjsToolsFileSync = api;

})(this);
