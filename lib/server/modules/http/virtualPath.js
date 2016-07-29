var url = require('url');
var chalk = require('chalk');
var paths = new Map();

module.exports = {
  add: function(filename, fn){
    if (paths.has(filename))
    {
      console.warn('virtualPath#add: callback for `' + filename + '` is already set');
      return;
    }

    paths.set(filename, fn);
  },
  remove: function(filename){
    if (!paths.has(filename))
    {
      console.warn('virtualPath#remove: no callback for `' + filename + '`, nothing to remove');
      return;
    }

    paths.delete(filename);
  },
  has: function(filename){
    return paths.has(filename);
  },
  get: function(filename){
    return paths.get(filename);
  },

  createMiddleware: function(http){
    return function virtualPathMiddleware(req, res, next){
      var location = url.parse(req.url, true, true);
      var filename = location.pathname;

      if (!paths.has(filename))
        next();

      if (paths.has(filename))
        paths.get(filename)({
          location: location,
          path: filename,
          encoding: http.resolveEncoding(req),
          isContentModified: function(date){
            return http.isContentModified(req, res, date);
          },
          responseToClient: function(content, headers, postfix){
            return http.responseToClient(req, res, content, headers || {}, postfix);
          },
          serverError: function(message){
            http.log(filename + ' ' + chalk.red('500'));
            res.writeHead(500);
            res.end(message || 'Error');
          },
          log: function(message, verboseOnly){
            return http.log(filename + ' ' + message, verboseOnly);
          },
          warn: function(message){
            return http.warn(filename + ' ' + message);
          },
          error: function(message){
            return http.error(filename + ' ' + message);
          }
        });
    };
  },
};
