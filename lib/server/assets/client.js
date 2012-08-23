;(function(global){

  basis.require('basis.data');

  //
  // import names
  //

  var DataObject = basis.data.DataObject;
  var Dataset = basis.data.Dataset;
  var STATE = basis.data.STATE;

  var console = global.console;
  if (typeof console == 'undefined')
    console = { log: Function(), warn: Function() };

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

      sendToServer('readFile', this.data.filename);      
    },
    save: function(){
      this.setState(STATE.PROCESSING);

      var self = this;
      sendToServer('saveFile', this.data.filename, this.data.content, function(err){
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
      DataObject.prototype.event_update.call(this);

      if ('filename' in delta || 'content' in delta)
        basis.resource(this.data.filename).update(this.data.content);
    }
  });

  function createFile(filename){
    var file = new File({
      data: {
        filename: filename
      }
    });

    fileMap[filename] = file;
    files.add([file]);    

    return file;
  }

  function removeFile(filename){
    var file = fileMap[filename];

    if (file)
    {
      delete fileMap[filename];
      file.destroy();
    }
  }

  function getFile(filename){
    return fileMap[filename];
  }

  //
  // init part
  //

  basis.ready(function(){
    // socket.io
    basis.dom.appendHead(
      basis.dom.createElement({
        description: 'script[src="/socket.io/socket.io.js"]',
        error: function(){
          console.warn('Error on loading ' + this.src);
        },
        load: function(){
          if (typeof io != 'undefined')
          {
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
            Object.iterate({
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
                var items = files.getItems();
                for (var i = 0, file; file = items[i]; i++)
                  removeFile(file.filename);

                for (var i = 0, fileData; fileData = filelist[i]; i++)
                {
                  if (fileData.type == 'file')
                  {
                    createFile(fileData.filename).update({
                      content: fileData.content,
                      type: fileData.type
                    });
                  }
                }
              },

              //
              // file events
              //
              newFile: function(data){
                console.log('New file', data);

                createFile(data.filename).update({
                  type: data.type,
                  content: data.content
                });
              },
              updateFile: function(data){
                console.log('File updated', data);

                var file = getFile(data.filename);
                file.update({
                  type: data.type,
                  content: data.content
                });
                file.setState(STATE.READY);
              },
              deleteFile: function(data){
                console.log('File deleted', data);

                removeFile(data.filename);
              },

              //
              // common events
              //
              error: function(data){
                console.log('error:', data.operation, data.message);
              }
            }, socket.on, socket);
          }
        }
      })
    );
  });

  //
  // export names
  //

  basis.devtools = {
    serverState: serverState,
    files: files,

    getFile: getFile,
    createFile: function(filename){
      sendToServer('createFile', filename);
    }
  };

})(this);