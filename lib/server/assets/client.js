;(function(global, console){

  if (typeof basis == 'undefined' || !basis.data)
    return;

  //
  // import names
  //

  var DataObject = basis.data.Object;
  var Dataset = basis.data.Dataset;
  var STATE = basis.data.STATE;
  var DEBUG = !!basis.config.debugSync;

  if (typeof console == 'undefined')
    console = {
      log: function(){},
      warn: function(){}
    };

  //
  // local vars
  //

  var sendToServer = function(){
    console.warn('basisjs-tools: Server backend is not available');
  };

  var sendToServerOffline = function(){
    console.warn('basisjs-tools: No connection with server :( Trying to send:', arguments);
  };

  var isReady = false;
  var serverState = new DataObject({
    data: {
      isOnline: false
    }
  });

  //
  // Files
  //

  var files = new Dataset();
  var fileMap = {};

  var File = DataObject.subclass({
    extendConstructor_: false,
    state: STATE.UNDEFINED,
    init: function(data){
      this.data = data;
      fileMap[data.filename] = this;

      DataObject.prototype.init.call(this);
    },
    read: function(){
      this.setState(STATE.PROCESSING);

      var self = this;
      sendToServer('readFile', this.data.filename, function(data){
        self.update(data);
      });      
    },
    save: function(content){
      this.update({
        content: content
      });
      this.setState(STATE.PROCESSING);

      var self = this;
      sendToServer('saveFile', this.data.filename, content, true, function(err){
        if (err)
        {
          self.setState(STATE.ERROR, err);

          if (DEBUG)
            console.log('basisjs-tools: File `' + self.data.filename + '` error on save: ', err);
        }
        else
        {
          self.setState(STATE.READY);

          if (DEBUG)
            console.log('basisjs-tools: File `' + self.data.filename + '` successfuly saved');
        }
      });
    },
    // for new basis
    emit_update: function(delta){
      DataObject.prototype.emit_update.call(this, delta);

      if ('filename' in delta || 'content' in delta)
        basis.resource(this.data.filename).update(this.data.content);
    },
    // for previous basis version
    event_update: function(delta){
      DataObject.prototype.event_update.call(this, delta);

      if ('filename' in delta || 'content' in delta)
        basis.resource(this.data.filename).update(this.data.content);
    }
  });

  function loadFiles(filelist){
    var files_ = [];  
    for (var i = 0, fileData; fileData = filelist[i]; i++)
    {
      if (fileData.type == 'file')
      {
        var filename = fileData.filename;
        var file = fileMap[filename] || new File({
          filename: filename
        });

        files_.push(file);
      }
    }     
    files.set(files_);
  }

  function createFile(data){
    // check for file existence
    var filename = data.filename;
    var file = fileMap[filename];

    if (!file){
      // create new file
      file = new File({
        filename: filename,
        content: data.content
      });

      files.add([file]);    
    }

    return file;
  }

  function updateFile(data){
    var file = getFile(data.filename);
    if (file)
    {
      file.update(data);
      file.setState(STATE.READY);    
    }  
  }

  function removeFile(filename){
    var file = fileMap[filename];

    if (file)
    {
      delete fileMap[filename];
      file.destroy();
    }
  }

  function getFile(filename, autocreate){
    var file = fileMap[filename];

    if (!file && autocreate)
    {
      file = createFile({
        filename: filename
      });
    }

    return file;
  }


  //
  // init socket
  //

  function onLoad(){
    var sendToServerOnline = function(){
      if (DEBUG)
        console.log('basisjs-tools: Send to server: ', arguments[0], arguments[1]);

      socket.emit.apply(socket, arguments);
    };

    var socket = io.connect('/');
    console.log('basisjs-tools: Synchronization with dev server via socket.io inited');

    //
    // add callbacks on socket events
    //

    // connection events
    socket.on('connect', function(){
      socket.emit('observe');
      sendToServer = sendToServerOnline;

      serverState.update({ isOnline: true });
    });

    socket.on('disconnect', function(){
      sendToServer = sendToServerOffline;

      serverState.update({ isOnline: false });
    });

    socket.on('observeReady', function(filelist){
      loadFiles(filelist);
    });


    // file events
    socket.on('newFile', function(data){
      createFile(data);
      
      if (DEBUG)
        console.log('basisjs-tools: New file', data);
    });

    socket.on('updateFile', function(data){
      updateFile(data);
      
      if (DEBUG)
        console.log('basisjs-tools: File updated', data);
    });

    socket.on('deleteFile', function(data){
      removeFile(data.filename);
      
      if (DEBUG)
        console.log('basisjs-tools: File deleted', data);
    });


    // common events
    socket.on('error', function(data){
      console.warn('basisjs-tools: error on ' + data.operation + ':', data.message);
    });
  }


  //
  // load socket.io client code
  //

  (function(){
    var url = '/socket.io/socket.io.js';
    var req = new XMLHttpRequest();

    req.open('GET', url, true);
    req.onreadystatechange = function(){
      if (req.readyState != 4)
        return;

      if (req.status >= 200 && req.status < 400)
      {
        try {
          (window.execScript || function(code){
            window['eval'].call(window, code);
          })(req.responseText);

          onLoad();
        } catch(e) {
          console.warn('basisjs-tools: Error on evaluate ' + url + ': ' + e);
        }
      }
      else
        console.warn('basisjs-tools: Error on loading ' + url);
    }
    req.send('');
  })();


  //
  // export names
  //

  basis.devtools = {
    serverState: serverState,
    files: files,

    getFileGraph: function(callback){
      sendToServer('getFileGraph', location.href, callback);
    },

    getFile: getFile,
    createFile: function(filename){
      sendToServer('createFile', filename);
    }
  };

})(this, this.console);