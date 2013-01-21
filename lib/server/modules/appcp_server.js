
  var http = require('http');
  var fs = require('fs');
  var url = require('url');
  var path = require('path');
  var socket_io = require('socket.io');
  var mime = require('mime');

  module.exports = {
    create: function(){
      var httpServer = http.createServer(function(req, res){
        var location = url.parse(req.url, true, true);
        var filename = path.normalize(__dirname + '/../appcp' + location.pathname);

        var isIndex = location.pathname == '/';
        if (isIndex)
          filename += 'index.html';

        if (fs.existsSync(filename))
        {
          var fileContent = fs.readFileSync(filename);

          if (isIndex)
            fileContent = String(fileContent).replace(/<\/body>/i, '<script>window.appcp_server = true</script></body>');

          res.writeHead(200, { 'Content-Type': mime.lookup(filename, 'text/plain') });
          res.end(fileContent);
        }
        else
        {
          res.writeHead(404);
          res.end(filename + ' not found');
        }
      });

      httpServer.listen(8001, function(){
        console.log('app control server created');
      });

      var io = socket_io.listen(httpServer);
      io.disable('log');

      io.sockets.on('connection', function(socket){
        socket.on('message', function(message){
          io.sockets.emit('message', message);
        });
      });
    }
  }
