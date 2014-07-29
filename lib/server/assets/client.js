;(function(global, console){

  var DEBUG = typeof basis != 'undefined' && !!basis.config.debugSync;


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
    console.warn('[basisjs-tools] Server backend is not available');
  };

  var sendToServerOffline = function(){
    console.warn('[basisjs-tools] No connection with server :( Trying to send:', arguments);
  };


  //
  // Classes
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
          console.warn('[basisjs-tools] duplicate fn & context pair');

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

      console.warn('[basisjs-tools] fn & context pair not found, nothing was removed');
    },

   /**
    * Call every attached callbacks with current token value.
    */
    apply: function(){
      var cursor = this;

      while (cursor = cursor.handler)
        // use try/catch to exclude callback influence on each other
        try {
          cursor.fn.call(cursor.context, this.value);
        } catch(e) {
          console.error('[basisjs-tools] Run callback fault: ', e);
        }
    }
  };

 /**
  * @class
  */
  var File = function(filename, content){
    this.filename = filename;
    this.value = content;

    fileMap[filename] = this;

    notifications.set(['new', this.filename, this.value]);
  };

  File.prototype = {
    set: function(content){
      if (this.value != content)
      {
        this.value = content;
        notifications.set(['update', this.filename, this.value]);
      }
    },
    read: function(callback){
      var self = this;
      sendToServer('readFile', this.filename, function(err, data){
        if (!err)
          self.set(data.content);
        if (typeof callback == 'function')
          callback.call(self);
      });
    },
    save: function(content, callback){
      this.set(content);

      var self = this;
      sendToServer('saveFile', this.filename, content, true, function(err){
        if (typeof callback == 'function')
          callback.call(self, err);

        if (DEBUG)
        {
          if (err)
            console.log('[basisjs-tools] File `' + self.filename + '` error on save: ', err);
          else
            console.log('[basisjs-tools] File `' + self.filename + '` successfuly saved');
        }
      });
    }
  };


  //
  // main part
  //

  var isOnline = new Token(false);
  var externalEditor = new Token(false);
  var notifications = new Token();
  var fileMap = {};

  notifications.apply = function(){
    var cursor = this;

    while (cursor = cursor.handler)
      cursor.fn.apply(cursor.context, this.value);
  };

  function getFile(filename, autocreate){
    var file = fileMap[filename];

    if (!file && autocreate)
      file = createFile(filename);

    return file;
  }

  function createFile(filename, content){
    return fileMap[filename] || new File(filename, content);
  }

  function updateFile(data){
    getFile(data.filename, true).set(data.content);
  }

  function removeFile(filename){
    var file = fileMap[filename];

    if (file)
    {
      delete fileMap[filename];
      notifications.set(['remove', filename]);
    }
  }


  //
  // init socket
  //

  (function(){
    var sendToServerOnline = function(){
      if (DEBUG)
        console.log('[basisjs-tools] Send to server: ', arguments[0], arguments[1]);

      socket.emit.apply(socket, arguments);
    };

    var socket;

    if (typeof io != 'undefined')
    {
      socket = io.connect('/', { transports: ['websocket', 'polling'] });
      console.log('[basisjs-tools] Synchronization with dev server via socket.io inited');
    }
    else
    {
      console.warn('[basisjs-tools] socket.io is not defined');
      return;
    }

    //
    // add callbacks on socket events
    //

    // connection events
    socket.on('connect', function(){
      var files = [];

      for (var fn in fileMap)
        if (fileMap.hasOwnProperty(fn))
          files.push(fn);

      sendToServer = sendToServerOnline;
      socket.emit('handshake', {
        files: files
      });

      isOnline.set(true);
    });

    socket.on('handshake', function(data){
      var filelist = data.files || [];

      externalEditor.set(data.editorEnabled);

      for (var i = 0, filename; filename = filelist[i]; i++)
        createFile(filename);
    });

    socket.on('disconnect', function(){
      sendToServer = sendToServerOffline;

      isOnline.set(false);
    });


    // file events
    socket.on('newFile', function(data){
      createFile(data.filename, data.content);

      if (DEBUG)
        console.log('[basisjs-tools] New file', data);
    });

    socket.on('updateFile', function(data){
      updateFile(data);

      if (DEBUG)
        console.log('[basisjs-tools] File updated', data);
    });

    socket.on('deleteFile', function(data){
      removeFile(data.filename);

      if (DEBUG)
        console.log('[basisjs-tools] File deleted', data);
    });


    // common events
    socket.on('error', function(err){
      console.error('[basisjs-tools] Socket error:', (err && err.operation ? 'operation ' + err.operation + ': ' + err.message : err));
    });
  })();


  //
  // export names
  //

  global.basisjsToolsFileSync = {
    isOnline: isOnline,
    externalEditor: externalEditor,
    notifications: notifications,

    getFile: getFile,
    getFiles: function(){
      var result = [];
      for (var key in fileMap)
        result.push(fileMap[key]);
      return result;
    },
    getFileGraph: function(callback){
      sendToServer('getFileGraph', location.href, callback);
    },
    createFile: function(filename, callback){
      sendToServer('createFile', filename, function(err){
        if (err)
          console.error(err);
        else
          createFile(filename, '');

        callback(err);
      });
    },
    openFile: function(filename, callback){
      if (!externalEditor.value)
      {
        console.warn('[basisjs-tools] External editor is not enabled (use `--editor` option for `basis server` to set up editor command).');
        return;
      }

      sendToServer('openFile', filename, function(err){
        if (err)
          console.error(err);

        callback(err);
      });
    }
  };


  // =========================================================
  // deprecated part for basis.js prior 1.3.1
  //
  // TODO: remove me in future
  //

  if (typeof basis != 'undefined' && basis.version < '1.3.1' && basis.data)
  {
    var basisDataFileMap = {};
    var files = new basis.data.Dataset();
    var serverState = new basis.data.Object({
      data: {
        isOnline: isOnline.value
      }
    });

    isOnline.attach(function(value){
      serverState.update({
        isOnline: value
      });
    });
    notifications.attach(function(action, filename, content){
      switch (action)
      {
        case 'new':
          files.add(basisDataFileMap[filename] = new BasisDataFile({
            data: {
              filename: filename,
              content: content
            }
          }));
          break;
        case 'update':
          basisDataFileMap[filename].update({
            content: content
          });
          break;
        case 'remove':
          basisDataFileMap[filename].destroy();
          break;
      }
    });

    var BasisDataFile = basis.data.Object.subclass({
      state: basis.data.STATE.UNDEFINED,
      read: function(){
        var self = this;

        this.setState(basis.data.STATE.PROCESSING);

        fileMap[this.data.filename].read(function(data){
          self.setState(basis.data.STATE.READY);
        });
      },
      save: function(content){
        var self = this;

        this.setState(basis.data.STATE.PROCESSING);

        fileMap[this.data.filename].save(content, function(err){
          if (err)
            self.setState(basis.data.STATE.ERROR, err);
          else
            self.setState(basis.data.STATE.READY);
        });
      },

      // for new basis
      emit_update: function(delta){
        basis.data.Object.prototype.emit_update.call(this, delta);

        if ('filename' in delta || 'content' in delta)
        {
          fileMap[this.data.filename].set(this.data.content);
          if (!basis.resource.isDefined || basis.resource.isDefined(this.data.filename, true))
            basis.resource(this.data.filename).update(this.data.content);
        }
      },
      // for previous basis version
      event_update: function(delta){
        basis.data.Object.prototype.event_update.call(this, delta);

        if ('filename' in delta || 'content' in delta)
        {
          fileMap[this.data.filename].set(this.data.content);
          basis.resource(this.data.filename).update(this.data.content);
        }
      }
    });


    //
    // export
    //

    basis.devtools = basis.object.extend(global.basisjsToolsFileSync, {
      serverState: serverState,
      files: files,
      getFile: function(filename){
        getFile(filename, true);
        return basisDataFileMap[filename];
      }
    });
  }

})(this, this.console);
