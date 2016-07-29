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
        return next();

      http.log(filename + chalk.yellow(' virtual path match'), true);
      paths.get(filename)({
        location: location,
        path: filename,
        encoding: http.resolveEncoding(req),
        isContentModified: function(date){
          return http.isContentModified(req, res, date);
        },
        responseToClient: function(content, options, postfix){
          http.responseToClient(req, res, content, options || {}, postfix);
        },
        responseError: function(status, message, logReason){
          http.responseError(req, res, status, message, logReason);
        },
        redirect: function(location, status){
          http.responseError(req, res, location, status);
        },
        log: function(message, verboseOnly){
          http.log(filename + ' ' + message, verboseOnly);
        },
        warn: function(message){
          http.warn(filename + ' ' + message);
        },
        error: function(message){
          http.error(filename + ' ' + message);
        }
      });
    };
  },
};
