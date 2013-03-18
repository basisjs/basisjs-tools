
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

        if (fs.existsSync(filename))
        {
          var stat = fs.statSync(filename);
          var isIndex = false;

          if (stat.isDirectory())
          {
            isIndex = true;
            filename += 'index.html';
            if (!fs.existsSync(filename))
            {
              res.writeHead(404);
              res.end(filename + ' not found');
              return;
            }
          }

          var fileContent = fs.readFileSync(filename);

          if (isIndex)
            fileContent = String(fileContent).replace(/<head>/i, '<head><script>window.appcp_server = true</script>');

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
        console.log('app control server created at port', 8001);
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
