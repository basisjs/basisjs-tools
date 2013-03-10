;(function(global){

  if (typeof basis == 'undefined')
    return;

  basis.require('basis.data');

  //
  // import names
  //

  var DataObject = basis.data.DataObject;
  var Dataset = basis.data.Dataset;
  var STATE = basis.data.STATE;

  var console = global.console;
  if (typeof console == 'undefined')
    console = {
      log: function(){},
      warn: function(){}
    };

  //
  // local vars
  //

  var sendToServer = function(){
    console.warn('Server backend is not available');
  };

  var serverState = new DataObject({
    data: {
      isReady: false,
      isOnline: false,
      connectionState: 'offline'
    }
  });

  //
  // Files
  //

  var files = new Dataset();
  var fileMap = {};

  var File = DataObject.subclass({
    read: function(){
      this.setState(STATE.PROCESSING);

      var file = this;
      sendToServer('readFile', this.data.filename, function(data){
        file.update(data);
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
          console.log('File `' + self.data.filename + '` saving error: ', err);
        }
        else
        {
          self.setState(STATE.READY);
          console.log('File `' + self.data.filename + '` successfuly saved');
        }
      });
    },
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
        var file = new File(basis.data({
          filename: fileData.filename
        }));

        fileMap[fileData.filename] = file;              
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
      file = new File(basis.data({
        filename: filename,
        content: data.content
      }));

      fileMap[filename] = file;
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
      file.setState(STATE.UNDEFINED);
    }

    return file;
  }

  //
  // script event handlers
  //

  function onError(){
    if (this.parentNode)
      this.parentNode.removeChild(this);

    console.warn('Error on loading ' + this.src);
  }

  function onLoad(){
    if (this.parentNode)
      this.parentNode.removeChild(this);

    if (typeof io == 'undefined')
      return;

    appcp.init();

    console.log('Connecting to server via socket.io');

    var socket = io.connect('/');
    serverState.update({ isReady: true }); 

    var sendToServerOffline = function(){
      console.warn('No connection with server :( Trying to send:', arguments);
    };

    var sendToServerOnline = function(){
      console.log('Send to server: ', arguments[0], arguments[1]);
      socket.emit.apply(socket, arguments);
    };

    //
    // add callbacks on events
    //
    basis.object.iterate({
      //
      // connection events
      //
      connect: function(){
        socket.emit('observe');
        sendToServer = sendToServerOnline;

        serverState.update({ isOnline: true });
      },
      disconnect: function(){
        sendToServer = sendToServerOffline;

        serverState.update({ isOnline: false });
      },
      observeReady: function(filelist){
        loadFiles(filelist);
      },
      //
      // file events
      //
      newFile: function(data){
        createFile(data);
        console.log('New file', data);
      },
      updateFile: function(data){
        updateFile(data);
        console.log('File updated', data);
      },
      deleteFile: function(data){
        removeFile(data.filename);
        console.log('File deleted', data);
      },

      //
      // common events
      //
      error: function(data){
        console.log('error:', data.operation, data.message);
      }
    }, socket.on, socket);
  }

  //
  // App Control Panel
  //
  var appcp = (function(){
    var socket;

    function init(){
      socket = io.connect('http://localhost:8001');
      socket.on('connect', function(){
        sendMessage('clientConnected');
      });
      socket.on('message', function(message){ 
        if (message.action == 'appcpReady')
          initTransport();

        if (message.action == 'call')
        {
          var fn = basis.appCP[message.data.method];
          if (typeof fn == 'function')
            basis.appCP[message.data.method].apply(null, message.data.args);
          else
            console.warn('Unknown ACP method:', message.data.method);
        }
      });
    }

    var transportInited = false;
    
    function initTransport(){
      if (transportInited)
      {
        sendMessage('ready');
        return;
      }

      var transferDiv = document.getElementById('transferDiv');
      if (transferDiv)
      {
        transferDiv.addEventListener('transferData', function(){
          var action = transferDiv.getAttribute('action');
          var data = transferDiv.innerText;

          console.log('transfer data action:', action);
          //console.log('transfer data:', data);

          sendMessage(action, data);
        });

        transportInited = true;
        sendMessage('ready');
      }
      else
      {
        console.warn('basis devpanel not found');
      }
    }

    function sendMessage(action, data){
      socket.emit('message', { 
        action: action, 
        data: data 
      });
    }

    return {
      init: init
    };
  })();

  //
  // init part
  //

  basis.ready(function(){
    var scriptEl = document.createElement('script');

    scriptEl.src = "/socket.io/socket.io.js";
    scriptEl.onload = onLoad;
    scriptEl.onerror = onError;

    document.getElementsByTagName('head')[0].appendChild(scriptEl);
  });

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

})(this);