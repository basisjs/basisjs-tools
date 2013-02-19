'use strict';

var html_at = require('../../ast').html;
var at = require('../../ast').js;
var path = require('path');
var throwIdx = 0;

module.exports = function(flow){

  var fconsole = flow.console;
  var queue = flow.files.queue;

  //
  // Init js section
  //

  fconsole.log('Init js');

  var globalScope = new at.Scope('global');
  var globalToken = ['object', []];
  globalScope.put('global', '?', globalToken);
  globalScope.put('this', '?', globalToken);
  globalToken.obj = globalScope.names;
  //globalScope.put('__resources__', 'hz', ['object', []]);

  flow.js = {
    globalScope: globalScope,
    rootBaseURI: {},
    rootNSFile: {},
    getFileContext: getFileContext,
    fn: [],
    namespaces: {}
    //resources: {}
  };


  //
  // Process files
  //

  fconsole.start('Process scripts');
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && !file.ast)
    {
      fconsole.start(file.relpath);

      if (file.htmlNode)
      {
        var attrs = html_at.getAttrs(file.htmlNode);
        var configAttr = false;

        if (attrs.hasOwnProperty('data-basis-config'))
          configAttr = 'data-basis-config';
        else
          if (attrs.hasOwnProperty('basis-config'))
            configAttr = 'basis-config';

        if (configAttr)
        {
          fconsole.log('[i] basis.js marker found (' + configAttr + ' attribute)');
          processBasisFile(flow, file, attrs[configAttr] || '');
        }
      }

      processFile(file, flow);

      fconsole.endl();
    }
  fconsole.endl();
};

module.exports.handlerName = '[js] Extract';


//
// main part
//

function getFileContext(file){
  return {
    __filename: file.filename || '',
    __dirname: file.baseURI,
    namespace: file.namespace || ''
  };
}

function createScope(file, flow, module){
  if (file.type == 'script' && !file.jsScope)
  {
    var scope = new at.Scope('function', flow.js.globalScope, module);
    var exports = ['object', []];

    if (!module)
      module = ['object', [['exports', exports]]];

    if (!module.obj)
      module.obj = {};

    module.obj.exports = exports;

    var basisResource = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'resource']);
    var basis = flow.js.globalScope.resolve(['name', 'basis']);
    var names = {
      __filename: ['string', file.relpath],
      __dirname: ['string', file.baseURI],
      global: flow.js.globalScope.resolve(['name', 'global']),
      basis: flow.js.globalScope.resolve(['name', 'basis']),
      resource: at.createRunner(function(token, this_, args){
        args = token[2]; // FIXME: it's a hack
        var uri = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, file.context)[0];
        if (uri)
        {
          token[1] = ['dot', ['name', 'basis'], 'resource'];
          token[1].ref_ = basisResource;
          token[1].refPath_ = 'basis.resource';
          token[2] = [args[0] = ['string', file.resolve(uri)]];
          basisResource.run.call(this, token, this_, args);
        }
      }),
      module: module,
      exports: exports
    };

    for (var name in names)
      scope.put(name, 'arg', names[name]);

    file.jsScope = scope;
  }
}

function defineHandler(scope, name, fn){
  if (name.indexOf('.') != -1)
  {
    var token = scope.resolve(at.parse(name, 1))
    
    if (!token)
    {
      console.warn('handler ' + name + ' is not resolved in specified scope');
      return;
    }

    token.run = fn;
  }
  else
  {
    var symbol = scope.get(name);

    if (!symbol)
    {
      console.warn('symbol ' + name + ' is not resolved in specified scope');
      return;
    }

    symbol.token = at.createRunner(fn);
  }
}

function astExtend(scope, dest, source){
  if (dest && source && source[0] == 'object')
  {
    if (!dest.obj)
      dest.obj = {};
    if (!dest.objSource)
      dest.objSource = {};
    for (var i = 0, props = source[1], prop; prop = props[i]; i++)
    {
      dest.obj[prop[0]] = scope.resolve(prop[1]) || prop[1];
      dest.objSource[prop[0]] = source;
    }
  }
}

function astComplete(scope, dest, source){
  if (dest && source && source[0] == 'object')
  {
    if (!dest.obj)
      dest.obj = {};
    if (!dest.objSource)
      dest.objSource = {};    
    for (var i = 0, props = source[1], prop; prop = props[i]; i++)
      if (prop[0] in dest.obj == false)
      {
        dest.obj[prop[0]] = scope.resolve(prop[1]) || prop[1];
        dest.objSource[prop[0]] = source;
      }
  }
}

function processFile(file, flow){
  // if file has ast - it's already processed
  if (file.ast)
    return;

  var globalScope = flow.js.globalScope;
  var fconsole = flow.console;
  var content = file.content;

  if (flow.options.jsCutDev)
    content = content.replace(/(;;;|\/\*\*\s*@cut.*?\*\/).*([\r\n]|$)/g, '$2');

  // extend file info
  file.context = getFileContext(file);
  file.deps = [];
  file.resources = [];
  file.ast = at.parse(content);

  if (!file.jsScope)
    file.jsScope = globalScope;

  // parse and apply scope
  try {
    file.ast = at.applyScope(file.ast, file.jsScope);

    if (file.jsScope != globalScope)
    {
      file.ast[1] = [['function', null, ['exports', 'module', 'basis', 'global', '__filename', '__dirname', 'resource'],
        file.ast[1]
      ]];
      file.ast[1][0].scope = file.jsScope;
    }

    // throw smth; -> throw N;
    if (flow.options.jsBuildMode)
    {
      file.throwCodes = file.ast.throws.map(function(token){
        var res = [++throwIdx, token.slice()];
        token[1] = ['num', throwIdx];
        return res;
      });
    }
  } catch(e) {
    console.warn('[FATAL ERROR] Parse error of ' + file.relpath + ': ' + (e.message || e));
    process.exit();
  }

  try {
    switch (file.namespace)
    {
      case 'basis':
        fconsole.log('[i] load basis.js module and add to global scope');

        var keys = Object.keys; // FIXME: basis.js overload Object.keys and break standart output functions behaviour, become stable for this case
        global.basis = require(flow.js.basisScript).basis;
        Object.keys = keys; // Object.keys overload fix  
      break;

      case 'basis.template':
        fconsole.log('[i] load basis/template.js module');

        basis.require('basis.template');
      break;
    }
  } catch(e) {

  }

  if (file.basisScript)
  {
    // get last global subscope as basis scope
    var basisScope = file.ast.scope.subscopes.slice(-1)[0];
    file.jsScope = basisScope;
    file.jsScope.put('global', 'arg', globalScope.get('global'));

    flow.js.basisPackageClue = flow.files.add({
      inline: true,
      type: 'script',
      content: '[].forEach(' + function(module){
        var fn = module[1];
        var ns = basis.namespace(module[0]);
        // basis, module, exports, resource, global, __dirname, __filename
        //fn.call(ns, basis, ns, ns.exports, basis.resource, this, "", "");
        // 'exports', 'module', 'basis', 'global', '__filename', '__dirname', 'resource'
        fn.call(ns, ns.exports, ns, basis, this, "", "", basis.resource);
        basis.object.complete(ns, ns.exports);
      }.toString() + ', this)'
    });


    //
    // namespaces
    //

    var createNS = function(path){
      var exports = ['object', []];
      exports.obj = {};
      
      var token = ['function', path, []];
      token.objSource = {};
      token.obj = {
        extend: at.createRunner(function(token, this_, args){
          astExtend(this.scope, this_.obj.exports, args[0]);
          astComplete(this.scope, this_, args[0]);
          token.obj = this_.obj;
        }),
        path: ['string', path],
        exports: exports,
        setWrapper: at.createRunner(function(token_, this_, args){
          //fconsole.log('setWrapper', arguments);
          token.setWrapper_ = args[0];
          if (args[0].ref_)
          {
            //token.ref_ = args[0].ref_;
            //token.refPath_ = args[0].refPath_;
          }
        })
      };

      token.run = function(token_, this_, args){
        //fconsole.log('!ns call', token);
        if (token.setWrapper_)
        {
          if (token.setWrapper_.run)
          {
            // TODO: make it works
            fconsole.log('TODO: namespace ' + path + ' call, and namespace has wrapper');
            process.exit();
          }
          else
            fconsole.log('[WARN] namespace ' + path + ' call, but namespace wrapper has no run handler');
        }
        else
        {
          fconsole.log('[WARN] namespace ' + path + ' call, but namespace has no wrapper');
        }
        
        //process.exit();
      }

      flow.js.namespaces[path] = token;

      return token;
    };    

    var getNamespace = function(namespace){
      var path = namespace.split('.');
      var root = path[0];
      var ns = globalScope.get(root);

      if (!ns)
      {
        ns = globalScope.put(root, 'ns', createNS(root)).token;
        ns.scope = globalScope;
      }
      else
        ns = ns.token;

      for (var i = 1; i < path.length; i++)
      {
        if (!ns.obj[path[i]])
          ns.obj[path[i]] = createNS(path.slice(0, i + 1).join('.'));

        ns = ns.obj[path[i]];
      }

      return ns;
    }; 


    //
    // resources
    //

    var resourceMap = {};
    var createResource = function(uri, resourceFile){
      if (resourceMap[uri])
        return resourceMap[uri];

      function createFetchMethod(methodName){
        return function(){
          //fconsole.log(methodName, this.file.jsScope === this.scope, uri, this.file.relpath, !!resourceFile.deps);
          if (resourceFile.type == 'script' && this.file.jsScope === this.scope)
          {
            fconsole.log('[basis.resource]', methodName, 'detected on top level -> add deps to contained file');
            if (!resourceFile.deps)
            {
              fconsole.incDeep();
              fconsole.incDeep();
              processFile(resourceFile, flow);
              fconsole.decDeep();
              fconsole.decDeep();
            }

            if (resourceFile.deps)
              resourceFile.deps.forEach(this.file.deps.add, this.file.deps);
          }
          else
          {
            fconsole.log('[basis.resource]', methodName, 'detected, but not on top level - ignored');
          }
        }
      }

      var token = resourceMap[uri] = ['function', null, []];
      token.obj = {
        fetch: at.createRunner(createFetchMethod('resource#fetch method call'))
      };
      token.run = createFetchMethod('resource call');
      return token;
    };


    //
    // main part
    //

    var handlers = {
      // basis.object.extend
      extend: function(token, this_, args){
        //fconsole.log('extend', arguments);
        astExtend(this.scope, args[0], args[1]);
        token.obj = args[0];
      },

      // basis.object.complete
      complete: function(token, this_, args){
        //fconsole.log('comlete', arguments);
        astComplete(this.scope, args[0], args[1]);
        token.obj = args[0];
      },

      // basis.namespace
      getNamespace: function(token, this_, args){
        //fconsole.log('getNamespace', arguments);
        var namespace = args[0];
        if (namespace && namespace[0] == 'string')
        {
          token.obj = getNamespace(namespace[1]).obj;
          if (args[1])
            token.obj.setWrapper.run(token, this_, [args[1]]);
        }
      },

      // basis.require
      requireNamespace: function(token, this_, args){
        //fconsole.log('requireNamespace', arguments, args[0] && args[0][0] == 'string');
        if (args[0] && args[0][0] == 'string')
        {
          var namespace = args[0][1];
          var parts = namespace.split(/\./);
          var root = parts[0];
          var rootFile = flow.js.rootNSFile[root];
          var nsToken = getNamespace(namespace);
          var newFile;
          var file = this.file;

          if (!rootFile)
          {
            // TODO: resolve filename relative to html file
            rootFile = flow.files.add({
              isBasisModule: true,
              basisWrap: true,
              filename: path.resolve(flow.js.rootBaseURI[root] || path.dirname(flow.options.file), root + '.js'),  
              nsToken: nsToken,
              namespace: root,
              package: root
            });
            flow.js.rootNSFile[root] = rootFile;
            //console.log('>>>', root, globalScope.get(root).token);
          }

          if (root == namespace)
          {
            newFile = rootFile;
          }
          else
          {
            newFile = flow.files.add({
              filename: rootFile.resolve(parts.join('/') + '.js'),
              nsToken: nsToken
            });
            newFile.basisWrap = true;
            newFile.namespace = namespace;
            newFile.package = root;
          }

          createScope(newFile, flow, nsToken);

          file.link(newFile);
          file.deps.push(newFile);

          fconsole.incDeep();
          fconsole.incDeep();
          processFile(newFile, flow);
          fconsole.decDeep();
          fconsole.decDeep();
        }
      }
    };

    for (var key in handlers)
      defineHandler(basisScope, key, handlers[key]);

    // search for config and populate it
    var basisConfig = file.jsScope.resolve(['name', 'config']);
    if (basisConfig)
    {
      fconsole.start('[i] config token found');

      basisConfig.obj = {};

      // if (file.autoload)
      // {
      //   fconsole.log('  * add autoload to config: ' + file.autoload);
      //   basisConfig.obj.autoload = ['string', file.autoload];
      // }

      fconsole.end();
    }
    else
    {
      fconsole.log('[!] config token not found');
    }

    // process ast
    file.ast = at.struct(file.ast, {
      file: file
    });

    // basis.resource
    defineHandler(globalScope, 'basis.resource', function(token, this_, args){
      // fconsole.log('basis.resource', token);

      if (!args[0])
      {
        //console.log('basis.resource', arguments);
        return;
      }

      args = token[2]; // FIXME: it's a hack
      var newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, this.file.context)[0];
      if (newFilename)
      {
        var file = this.file;
        var newFile = flow.files.add({
          filename: newFilename,
          jsRefCount: 0
        });
        newFile.basisWrap = true;
        newFile.isResource = true;

        createScope(newFile, flow);

        file.link(newFile);
        file.resources.push(newFile);
        newFile.jsRefCount++;

        token.resourceRef = newFile;
        token[2] = [['string', newFile.relpath]];
        token.call = createResource(newFilename, newFile);
        token.obj = token.call.obj;
      }
    });

    // basis.asset
    defineHandler(globalScope, 'basis.asset', function(token, this_, args){
      //fconsole.log('basis.asset');
      
      args = token[2]; // FIXME: it's a hack
      var newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, this.file.context)[0];
      if (newFilename)
      {
        var newFile = flow.files.add({
          filename: newFilename
        });
        //file.link(newFile);
        newFile.outputContent = newFile.content;
        newFile.outputFilename = flow.outputResourceDir + newFile.digest + newFile.ext;
        newFile.fileRef = newFile.relOutputFilename;

        token.splice(0, token.length, 'string', newFile.fileRef || '');

        return token;
      }
    });

    // autoload here because we can't resolve basis.resource before ast.struct
    if (file.autoload)
      handlers.requireNamespace.call({ file: file }, null, null, [['string', file.autoload]]);
  }
  else
  {
    // FIXME: temporary here - move to proper place
    if (file.namespace == 'basis.template.htmlfgen')
    {
      flow.tmpl.fgen = file;
    }
    if (file.namespace == 'basis.template')
    {
      flow.tmpl.module = file;
      var getTheme = function(name){
        if (!name)
          name = 'base';

        if (flow.tmpl.themes[name])
          return flow.tmpl.themes[name];

        var fn = function(name){
          return at.createRunner(function(token, this_, args){
            fconsole.log('[basis.template] template#' + name + ' call', args);
          });
        };

        function addSource(key, value){
          fconsole.log('[basis.template] define template `' + key + '` in `' + theme.name + '` theme');
          resources[key] = value;
          return value;
        }

        var resources = {};
        var theme = {
          name: name,
          fallback: fn('fallback'),
          define: at.createRunner(function(token, this_, args){
            //fconsole.log('define', args);
            if (!args.length || !args[0])
            {
              console.warn('basis.template.define w/o args', args);
              return;
            }

            // FIXME: find better way to evaluate args
            var what = globalScope.resolve(args[0]);
            var by = globalScope.resolve(args[1]);

            //fconsole.log('define', what, by);

            if (what[0] == 'string')
            {
              if (!by || by[0] != 'object')
              {
                if (!by || args.length == 1)
                {
                  // return getSourceByPath(what);
                }
                else
                {
                  return addSource(what[1], by);
                }
              }
              else
              {
                var namespace = what[1];
                var props = by[1];
                var result = ['object', []];
                result.obj = {};

                for (var i = 0; i < props.length; i++)
                  result.obj[namespace + '.' + props[i][0]] = addSource(namespace + '.' + props[i][0], props[i][1]);

                return result;
              }
            }
            else
            {
              if (what[0] == 'object')
              {
                var props = by[1];

                for (var i = 0; i < props.length; i++)
                  addSource(props[i][0], props[i][1]);

                 return theme;
              }
              else
                console.warn('Wrong first argument for basis.template.Theme#define');
            }
          }),
          apply: fn('apply'),
          getSource: fn('getSource'),
          drop: at.createRunner(function(token, this_, args){
            console.warn('basis.template.theme#drop should never call in build');
          })
        };

        flow.tmpl.themes[name] = theme;
        flow.tmpl.themeResources[name] = resources;

        return theme;
      };

      // basis.template.theme
      defineHandler(file.jsScope, 'getTheme', function(token, this_, args){
        //fconsole.log('getTheme');
        var name = args[0] ? (args[0][0] == 'string' ? args[0][1] : '' ) : '';
        token.obj = getTheme(name);
      });
    };

    // process ast
    file.ast = at.struct(file.ast, {
      file: file
    });

    if (file.nsToken)
    {
      astComplete(file.jsScope, file.nsToken, file.nsToken.obj.exports);
      //astExtend(file.jsScope, file.nsToken.obj.exports, file.nsToken.obj.exports);
    }

    // FIXME: temporary here - move to proper place
    if (file.namespace == 'basis.l10n')
    {
      flow.l10n.module = file;
      var defList = flow.l10n.defList;
      var getTokenList = flow.l10n.getTokenList;
      var pathes = flow.l10n.pathes;
      var cultureList = flow.l10n.cultureList;

      // TODO: fetch culture list from basis.l10n
      defineHandler(globalScope, 'basis.l10n.setCultureList', function(token, this_, args){
        var list = at.getCallArgs(token[2], getFileContext(this.file))[0];

        fconsole.log('[basis.l10n] ' + at.translate(token) + ' in ' + this.file.relpath);

        if (typeof list == 'string')
          list = list.trim().split(/\s+/);

        if (Array.isArray(list))
        {
          for (var i = 0, cultureDef; cultureDef = list[i]; i++)
          {
            var clist = cultureDef.split(/\//);
            list[i] = clist[0];
          }

          fconsole.log('        [OK] Set culture list ' + JSON.stringify(list));
          list.forEach(cultureList.add, cultureList);
        }
        else
        {
          fconsole.log('        [!] Can\'t convert into array (ignored)');
        }
      });

      // basis.l10n.createDictionary
      defineHandler(file.jsScope, 'basis.l10n.createDictionary', function(token, this_, args){
        //fconsole.log('basis.l10n.createDictionary', args);
        var eargs = at.getCallArgs(token[2], getFileContext(this.file));
        var entry = {
          args: token[2],
          name: eargs[0],
          path: path.resolve(flow.options.base, eargs[1]),
          keys: eargs[2],
          file: this.file
        };

        fconsole.log('[basis.l10n] createDictionary ' + entry.name + ' -> ' + reldir(flow, entry.path));

        this.file.hasL10n = true;
        token.l10n = entry;
        defList.push(entry);

        if (!pathes[entry.path])
          pathes[entry.path] = {
            __files: []
          };

        pathes[entry.path].__files.add(this.file);
        pathes[entry.path][entry.name] = this.file;
      });

      // basis.l10n.getToken
      defineHandler(file.jsScope, 'basis.l10n.getToken', function(token, this_, args){
        //fconsole.log('basis.l10n.getToken', args);
        if (args.length == 1 && args[0] && args[0][0] == 'string')
        {
          fconsole.log('[basis.l10n] getToken ' + args[0][1]);

          var entry = {
            args: args,
            file: this.file
          };
          this.file.hasL10n = true;
          token.l10n = entry;
          getTokenList.push(entry);
        }
      })
    }
  }
}

function reldir(flow, dir){
  return path.relative(flow.options.base, dir).replace(/\\/g, '/') + '/';  // [base]
}

function processBasisFile(flow, file, attrValue){
  var fconsole = flow.console;

  file.basisScript = true;
  file.basisConfig = attrValue;
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

    for (var key in config.path)
    {
      flow.js.rootBaseURI[key] = file.htmlFile.resolve(config.path[key]) + '/';
      fconsole.log('    * Path found for `' + key + '`: ' + config.path[key] + ' -> ' + flow.js.rootBaseURI[key]);
    }

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
  }
  else
    fconsole.log('    <config is empty>');

  fconsole.end();
}
