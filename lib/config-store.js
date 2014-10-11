// fork of https://github.com/yeoman/configstore
// reduce dependency count and use json to store config instead of yaml

'use strict';

var path = require('path');
var os = require('os');
var fs = require('fs');
var osenv = require('osenv');
var mkdirp = require('mkdirp');
var getTempDir = os.tmpdir || os.tmpDir; //support node 0.8

var user = (osenv.user() || 'node-config-store').replace(/\\/g, '_');
var tmpDir = path.join(getTempDir(), user);
var configDir = process.env.XDG_CONFIG_HOME || path.join(osenv.home() || tmpDir, '.config');
var permissionError = '\nYou don\'t have access to this file.\n';

function extend(dest, source){
  for (var key in source)
    if (source.hasOwnProperty(key))
      dest[key] = source[key];
  return dest;
}

function ConfigStore(id, defaults){
  this.path = path.join(configDir, 'configstore', id + '.json');
  this.values = [defaults || {}, this.values || {}].reduce(extend, {});
}

ConfigStore.prototype = Object.create(Object.prototype, {
  values: {
    get: function(){
      if (this.values_)
        return this.values_;

      try {
        return this.values_ = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      } catch(err) {
        // create dir if it doesn't exist
        if (err.code === 'ENOENT')
          return {};

        // improve the message of permission errors
        if (err.code === 'EACCES')
          err.message = err.message + permissionError;

        throw err;
      }
    },
    set: function(val){
      this.values_ = val;
      this.save();
    }
  },
  size: {
    get: function(){
      return Object.keys(this.values || {}).length;
    }
  }
});

ConfigStore.prototype.save = function(key){
  try {
    // make sure the folder exists, it could have been
    // deleted meanwhile
    mkdirp.sync(path.dirname(this.path));
    fs.writeFileSync(this.path, JSON.stringify(this.values_, null, 2), 'utf8');
  } catch(err) {
    // improve the message of permission errors
    if (err.code === 'EACCES')
      err.message = err.message + permissionError;

    throw err;
  }
};

ConfigStore.prototype.get = function(key){
  return this.values[key];
};

ConfigStore.prototype.set = function(key, val){
  this.values[key] = val;
  this.save();
};

ConfigStore.prototype.del = function(key){
  delete this.values[key];
  this.save();
};

module.exports = ConfigStore;
module.exports.exists = function(id){
  return fs.existsSync(path.join(configDir, 'configstore', id + '.json'));
};
