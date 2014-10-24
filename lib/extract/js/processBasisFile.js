module.exports = function processBasisFile(flow, file, attrValue){
  var fconsole = flow.console;

  file.basisScript = true;
  file.basisConfig = attrValue;
  file.config = {
    path: { basis: '' }
  };
  file.namespace = 'basis';
  file.package = 'basis';

  flow.js.rootNSFile.basis = file;
  flow.js.basisScript = file.filename;

  //
  // parse basis config
  //

  var config = false;

  if (/\S/.test(file.basisConfig))
  {
    try {
      config = Function('return{' + file.basisConfig + '}')();
    } catch(e) {
      fconsole.log('    Parse config:');
      fconsole.log('        [WARN] basis-config parse fault: ' + e);
    }
  }
  else
    fconsole.log('    <config is empty>');


  //
  // load basis.js
  //

  fconsole.log('[i] load basis.js module and add to global scope');

  // add config to global, to setup basis.js (has effect since 1.4)
  process.basisjsConfig = config || '';

  // require basis.js
  var basis = require(file.filename).basis;
  basis.config.extProto = false; // disable prototype extension for basis.js prior 1.3
  global.basis = basis;          // FIXME: we should not extend global

  flow.js.basisVersion = basis.version || 'unknown';
  fconsole.log('    Version: ' + basis.version);

  // omit dev output
  basis.dev.log = function(){};
  basis.dev.info = function(){};
  // log basis.dev.warn/error output
  ['warn', 'error'].forEach(function(fnName){
    if (fnName in basis.dev)
      basis.dev[fnName] = function(){
        flow.warn({
          message: ['basis.dev.' + fnName + ':'].concat(Array.prototype.slice.call(arguments))
        });
      };
  });

  //
  // process config
  //
  if (config)
  {
    // try to use processConfig function (available since 1.3.0)
    if (typeof basis.processConfig == 'function')
    {
      var processedConfig = basis.resource.resolveURI
        ? basis.config
        : basis.processConfig(config);

      fconsole.start('    Config:');
      fconsole.list(JSON.stringify(processedConfig, null, 2).split('\n'), '   ');
      fconsole.end();

      for (var name in processedConfig.modules)
      {
        var module = processedConfig.modules[name];
        flow.js.rootBaseURI[name] = module.path + '/';
        flow.js.rootFilename[name] = module.filename;
        delete module.filename;
        delete module.path;

        if (!Object.keys(module).length)
          delete processedConfig.modules[name];
      }

      file.config = processedConfig;
      file.autoload = processedConfig.autoload;

      fconsole.start('    Processed config:');
      fconsole.list(JSON.stringify(processedConfig, null, 2).split('\n'), '   ');
      fconsole.end();

      return;
    }

    // prior basis.js 1.3
    fconsole.log('    Parse config:');

    if (!config.path)
      config.path = {};

    for (var property in config)
    {
      switch (property) {
        case 'path':
          for (var key in config.path)
          {
            flow.js.rootBaseURI[key] = file.htmlFile.resolve(config.path[key]) + '/';
            file.config.path[key] = '';
            fconsole.log('      * Path found for `' + key + '`: ' + config.path[key] + ' -> ' + flow.js.rootBaseURI[key]);
          }
          break;

        case 'noConflict':
        case 'extProto':
          file.config[property] = !!config[property];
          fconsole.log('      * Option `' + property + '`: ' + file.config[property]);
          break;

        case 'autoload':
          if (config.autoload)
          {
            fconsole.log('      * Autoload found: ' + config.autoload);

            var autoload = config.autoload;
            var m = config.autoload.match(/^((?:[^\/]*\/)*)([a-z$_][a-z0-9$_]*)((?:\.[a-z$_][a-z0-9$_]*)*)$/i);
            var rootNS;
            if (m)
            {
              if (m[2] != 'basis')
              {
                rootNS = m[2];
                autoload = m[2] + (m[3] || '');
                fconsole.log('        [i] namespace: ' + autoload);
                if (m[1])
                {
                  fconsole.log('        [i] set path for `' + m[2] + '`' + (m[2] in flow.js.rootBaseURI ? ' (override)' : '') + ': ' + m[1]);
                  flow.js.rootBaseURI[m[2]] = file.htmlFile.resolve(m[1]) + '/';
                  file.config.path[rootNS] = '';
                }
              }
              else
              {
                autoload = false;
                fconsole.log('        [!] value for autoload can\'t be `basis` (setting ignored)');
              }
            }
            else
            {
              autoload = false;
              fconsole.log('      [!] wrong autoload value (setting ignored)');
            }

            if (autoload)
            {
              fconsole.log('      [i] full path: ' + (flow.js.rootBaseURI[rootNS] || file.htmlFile.baseURI) + autoload.replace(/\./g, '/') + '.js');
              file.autoload = autoload;
            }
          }
          break;

        default:
          // copy as is
          file.config[property] = config[property];
          fconsole.log('    * Option `' + property + '`: ' + file.config[property]);
      }
    }
  }
};
