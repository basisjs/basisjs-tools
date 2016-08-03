;(function(global, console){

  var DEBUG = typeof basis != 'undefined' && !!basis.config.debugSync;
  var console = global.console;


  //
  // Message output
  //

  if (typeof console == 'undefined')
    console = {
      log: function(){},
      warn: function(){},
      error: function(){}
    };

  var sendToServer = function(){
    console.warn('basisjs-tools: Server backend is not available');
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
  // API
  //

  var api = {
    isOnline: new Token(false),
    notifications: new Token,

    getAppProfile: function(callback){
      sendToServer('getAppProfile', location.href, callback);
    },
    getBundle: function(config, callback){
      sendToServer('getBundle', config || location.href, callback);
    }
  };

  api.notifications.apply = function(){
    var cursor = this;

    while (cursor = cursor.handler)
      cursor.fn.apply(cursor.context, this.value);
  };


  //
  // init socket
  //

  var socket = (function(){
    var socket;
    var sendToServerOffline = function(){
      console.warn('basisjs-tools: No connection with server :( Trying to send:', arguments);
    };
    var sendToServerOnline = function(){
      if (DEBUG)
        console.log('basisjs-tools: Send to server: ', arguments[0], arguments[1]);

      socket.emit.apply(socket, arguments);
    };


    if (typeof io != 'undefined')
    {
      socket = io.connect(location.host, { transports: ['websocket', 'polling'] });
      console.log('basisjs-tools: Synchronization with dev server via socket.io inited');
    }
    else
    {
      console.warn('basisjs-tools: socket.io is not defined');
      return;
    }

    //
    // add callbacks on socket events
    //

    // connection events
    socket.on('connect', function(){
      sendToServer = sendToServerOnline;

      api.isOnline.set(true);
    });

    socket.on('disconnect', function(){
      sendToServer = sendToServerOffline;

      api.isOnline.set(false);
    });

    // common events
    socket.on('error', function(err){
      console.error('basisjs-tools: Socket error:', (err && err.operation ? 'operation ' + err.operation + ': ' + err.message : err));
    });

    return socket;
  })();

  // <!--inject-->

  // export to global
  global.socket = socket;
  global.basisjsToolsFileSync = api;

})(this, this.console);
