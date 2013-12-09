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

  fconsole.start('    Parse config:');

  if (/\S/.test(file.basisConfig))
  {
    var config = {};
    try {
      config = Function('return{' + file.basisConfig + '}')();
    } catch(e) {
      fconsole.log('      [WARN] basis-config parse fault: ' + e);
    }

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
            fconsole.log('    * Path found for `' + key + '`: ' + config.path[key] + ' -> ' + flow.js.rootBaseURI[key]);
          }
          break;

        case 'noConflict':
        case 'extProto':
          file.config[property] = !!config[property];
          break;

        case 'autoload':
          if (config.autoload)
          {
            fconsole.log('    * Autoload found: ' + config.autoload);

            var autoload = config.autoload;
            var m = config.autoload.match(/^((?:[^\/]*\/)*)([a-z$_][a-z0-9$_]*)((?:\.[a-z$_][a-z0-9$_]*)*)$/i);
            var rootNS;
            if (m)
            {
              if (m[2] != 'basis')
              {
                rootNS = m[2];
                autoload = m[2] + (m[3] || '');
                fconsole.log('      [i] namespace: ' + autoload);
                if (m[1])
                {
                  fconsole.log('      [i] set path for `' + m[2] + '`' + (m[2] in flow.js.rootBaseURI ? ' (override)' : '') + ': ' + m[1]);
                  flow.js.rootBaseURI[m[2]] = file.htmlFile.resolve(m[1]) + '/';
                  file.config.path[rootNS] = '';
                }
              }
              else
              {
                autoload = false;
                ;;;fconsole.log('      [!] value for autoload can\'t be `basis` (setting ignored)');
              }
            }
            else
            {
              autoload = false;        
              ;;;fconsole.log('      [!] wrong autoload value (setting ignored)');
            }

            if (autoload)
            {
              fconsole.log('      [i] full path: ' + (flow.js.rootBaseURI[rootNS] || file.htmlFile.baseURI) + autoload.replace(/\./g, '/') + '.js');
              file.autoload = autoload;
            }
          }
          break;

        default:
          // ignore
      }
    }
  }
  else
    fconsole.log('    <config is empty>');

  fconsole.end();
}
