var html_at = require('../../ast').html;
var at = require('../../ast').js;
var path = require('path');
var l10nContext = require('../l10n/context.js');
var utils = require('../../build/misc/utils.js');
var throwIdx = 0;

var processBasisFile = require('./processBasisFile.js');
var basisResolveURI;

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
  globalScope.put('window', '?', globalToken);
  globalToken.obj = globalScope.names;

  flow.js = {
    globalScope: globalScope,
    rootBaseURI: {},
    rootFilename: {},
    rootNSFile: {},
    getFileContext: getFileContext,
    //classes: [],
    resources: [],
    namespaces: {},
    fn2ns: {}
    //resources: {}
  };

  flow.tmpl = {
    themes: {},
    themeResources: {}
  };

  flow.l10n = {
    cultureList: [],  // TODO: fetch culture list from basis.l10n
    defList: [],
    getTokenList: [],
    pathes: {},
    tokens: {},

    dictList: {}
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
          basisResolveURI = global.basis.resource.resolveURI;
        }
      }

      processFile(file, flow);

      fconsole.endl();
    }
  fconsole.endl();
};

module.exports.handlerName = '[js] Extract';
module.exports.extraInfo = function(flow){
  if (flow.js.basisScript)
  {
    var commit = utils.fetchCommit(path.dirname(flow.js.basisScript) + '/..');

    return 'basisjs#' + (flow.js.basisVersion || 'unknown') + (commit ? ' (' + commit + ')' : '');
  }
};


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
    var exports;

    if (!module)
    {
      exports = ['object', []];
      module = ['object', [
        ['exports', exports]
      ]];
      module.obj = {
        exports: exports
      };
    }
    else
    {
      exports = module.obj.exports;
    }

    var scope = new at.Scope('function', flow.js.globalScope, exports);
    var basisResource = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'resource']);
    var basis = flow.js.globalScope.resolve(['name', 'basis']);
    var baseURI = ['string', flow.js.oldBasis ? file.baseURI : file.baseURI.replace(/\/$/, '')];
    var names = {
      __filename: ['string', '/' + file.relpath],
      __dirname: ['string',
        flow.js.oldBasis
          ? '/' + file.reldir + '/'
          : '/' + file.reldir
      ],
      global: flow.js.globalScope.resolve(['name', 'global']),
      basis: flow.js.globalScope.resolve(['name', 'basis']),
      resource: at.createRunner(function(token, this_, args){
        // resource(path) -> basis.resource("__dirname" + path)
        token[1] = ['dot', ['name', 'basis'], 'resource'];
        token[1].ref_ = basisResource;
        token[1].refPath_ = 'basis.resource';

        var filename = args[0][0] == 'string'
          ? args[0][1]
          : at.getCallArgs(args, this.file.context, { warn: function(){} }, this.file)[0];

        if (typeof filename == 'string')
          token[2] = [args[0] = ['string', utils.relToIndex(flow, filename, file.baseURI)]];

        basisResource.run.call(this, token, this_, args);
      }),
      module: module,
      exports: exports
    };

    if (!flow.js.oldBasis)
    {
      var basisRequire = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'require']);
      names.require = at.createRunner(function(token, this_, args){
        // require(path, base) -> basis.require(path, base || "__dirname")
        token[1] = ['dot', ['name', 'basis'], 'require'];
        token[1].ref_ = basisRequire;
        token[1].refPath_ = 'basis.require';
        token[2] = [args[0], args[1] || (args[1] = baseURI.slice(0))];
        basisRequire.run.call(this, token, this_, args);
      });
    }

    // local `asset` function supported since 1.4
    if (basisResolveURI)
    {
      names.asset = at.createRunner(function(token, this_, args){
        args = token[2]; // FIXME: it's a hack
        var newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, this.file.context, flow, this.file)[0];
        if (newFilename)
        {
          var newFile = flow.files.add({
            filename: basisResolveURI(newFilename, file.baseURI, 'asset(\'{url}\')')
          });
          this.file.link(newFile, token);

          //file.link(newFile, token);
          newFile.outputContent = newFile.content;
          newFile.outputFilename = flow.outputResourceDir + newFile.digest + newFile.ext;
          newFile.fileRef = newFile.relOutputFilename;

          token.splice(0, token.length, 'string', newFile.fileRef || '');

          return token;
        }
        else
        {
          flow.warn({
            file: this.file.relpath,
            message: 'basis.asset: first argument is not resolved, token: ' + at.translate(token)
          });
        }
      });
    }

    for (var name in names)
      scope.put(name, 'arg', names[name]);

    file.jsScope = scope;
  }
}

function defineHandler(scope, name, fn){
  if (name.indexOf('.') != -1)
  {
    var token = scope.resolve(at.parse(name, 1));

    if (!token)
      throw 'handler ' + name + ' is not resolved in specified scope';

    token.run = fn;
  }
  else
  {
    var symbol = scope.get(name);

    if (!symbol)
      throw 'symbol ' + name + ' is not resolved in specified scope';

    symbol.run = fn;  // does it affect anything?
    symbol.token.run = fn;
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
  var defineHandler_ = defineHandler;
  defineHandler = function(scope, name, fn){
    try {
      defineHandler_(scope, name, fn);
    } catch(e) {
      flow.warn({
        file: file.relpath,
        message: e
      });
    }
  };


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

  // parse
  try {
    file.ast = at.parse(content);
  } catch(e) {
    file.ast = ['toplevel', []];
    flow.warn({
      fatal: true,
      file: file.relpath,
      message: 'Javascript parse error of ' + file.relpath + (' (line: ' + e.line + ', col: ' + e.col + ')') + ':\n' + (e.message || e)
    });
  }

  // apply scope
  if (!file.jsScope)
    file.jsScope = globalScope;

  file.ast = at.applyScope(file.ast, file.jsScope);

  if (file.jsScope != globalScope)
  {
    file.ast[1] = [['function', null, ['exports', 'module', 'basis', 'global', '__filename', '__dirname', 'require', 'resource', 'asset'],
      file.ast[1]
    ]];
    file.ast[1][0].scope = file.jsScope;
  }

  // collect throws
  file.throwCodes = file.ast.throws.map(function(token){
    return [++throwIdx, token.slice(), token];
  });

  try {
    switch (file.namespace)
    {
      case 'basis.template':
        fconsole.log('[i] load basis/template.js module');

        basis.require('basis.template');
      break;
    }
  } catch(e) {
    flow.warn({
      fatal: true,
      file: file.relpath,
      message: 'Namespace ' + file.namespace + ' load fault:\n' + (e.message || e)
    });
  }

  if (file.basisScript)
  {
    // get last global subscope as basis scope
    var basisScope = file.ast.scope.subscopes.slice(-1)[0];
    file.jsScope = basisScope;
    file.jsScope.put('global', 'arg', globalScope.get('global'));

    //
    // namespaces
    //

    var createNS = function(path){
      var pathToken = ['string', path];
      var exports = ['object', [
        ['path', pathToken]
      ]];
      exports.obj = {
        path: pathToken
      };

      var token = ['function', path, []];
      token.objSource = {};
      token.obj = {
        extend: at.createRunner(function(token_, this_, args){
          astExtend(this.scope, this_.obj.exports, args[0]);
          astComplete(this.scope, this_, args[0]);
          token_.obj = this_.obj;
          token_.ref_ = token;
        }),
        path: ['string', path],
        exports: exports,

        // TODO: remove when stop support for basis.js prior to 1.0
        // it's from times when namespaces can have special function
        // that invokes on namespace as function invocation
        setWrapper: at.createRunner(function(token_, this_, args){
          token.setWrapper_ = args[0];
        })
      };

      // TODO: remove when stop support for basis.js prior to 1.0
      // it's from times when namespaces was functions
      token.run = function(token_, this_, args){
        //fconsole.log('!ns call', token);
        if (token.setWrapper_)
        {
          if (token.setWrapper_.run)
            token.setWrapper_.run.call(this, token_, this_, args);
        }
      };

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
        return function(token){
           if (resourceFile.type == 'script') // && this.file.jsScope === this.scope)
           {
            // fconsole.log('[basis.resource]', methodName, '(' + resourceFile.relpath + ')', 'detected on top level -> add deps to contained file');
            fconsole.log('[basis.resource]', methodName, '(' + resourceFile.relpath + ')');
            if (!resourceFile.deps)
            {
              fconsole.incDeep(2);
              processFile(resourceFile, flow);
              fconsole.decDeep(2);
            }

            if (resourceFile.deps)
              resourceFile.deps.forEach(this.file.deps.add, this.file.deps);

            token.ref_ = resourceFile.jsScope.get('module').token.obj.exports;
          }
          // else
          // {
          //   fconsole.log('[basis.resource]', methodName, '(' + resourceFile.relpath + ')', 'detected, but not on top level - ignored');
          // }
        };
      }

      var token = resourceMap[uri] = ['function', null, []];
      token.obj = {
        fetch: at.createRunner(createFetchMethod('resource#fetch method call'))
      };
      token.run = createFetchMethod('resource call');
      return token;
    };

    function getResourceRunner(token, this_, args){
      // fconsole.log('basis.resource', token);

      if (!args[0])
      {
        //console.log('basis.resource', arguments);
        return;
      }

      args = token[2]; // FIXME: it's a hack
      var newFilename = args[0][0] == 'string'
        ? args[0][1]
        : at.getCallArgs(args, this.file.context, { warn: function(){} }, this.file)[0];

      if (typeof newFilename != 'string')
      {
        // FIXME: temporary solution to avoid warnings in basis.template/basis.l10n that using
        // basis.resource to get templates & dictionary dinamically
        if (!/^basis\.(template|l10n)$/.test(this.file.namespace))
          flow.warn({
            file: this.file.relpath,
            message: 'Unresolved basis.resource: ' + at.translate(token)
          });

        return;
      }

      // var arg = this.scope.simpleExpression(args[0]);
      // var newFilename = arg && arg[0] == 'string' ? arg[1] : null;
      if (newFilename)
      {
        var file = this.file;
        var newFile = flow.files.add({
          filename: utils.resolveToBase(flow, newFilename, path.dirname(flow.options.file)),
          jsRefCount: 0
        });
        newFile.isResource = true;

        createScope(newFile, flow);

        file.link(newFile, token);
        file.resources.push(newFile);
        newFile.jsRefCount++;

        token.resourceRef = newFile;
        token[2] = [['string', newFile.relpath]];
        token.call = createResource(newFilename, newFile);
        token.obj = token.call.obj;

        flow.js.resources.push(token);
      }
    }


    //
    // main part
    //

    var handlers = {
      // basis.object.extend
      extend: function(token, this_, args){
        //fconsole.log('extend', arguments);
        if (this.file.jsScope == basisScope)
        {
          var arg0 = token[2][0];
          if (arg0[0] == 'name' && arg0[1] == 'Object')
            flow.js.oldBasis = true;
        }

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
        var arg0 = args[0][0] == 'string'
          ? args[0][1]
          : at.getCallArgs(args, this.file.context, { warn: function(){} }, this.file)[0];

        if (typeof arg0 != 'string')
        {
          if (this.file.namespace != 'basis')
            flow.warn({
              file: this.file.relpath,
              message: 'Unresolved basis.require: ' + at.translate(token)
            });

          return;
        }

        //fconsole.log('requireNamespace', token);
        if (!/[^a-z0-9_\.]/i.test(arg0) && path.extname(arg0) != '.js')
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
              filename:
                flow.js.rootFilename[root] ||
                path.resolve(flow.js.rootBaseURI[root] || path.dirname(flow.options.file), root + '.js'),
              nsToken: nsToken,
              package: flow.js.rootNSFile.basis.package,
              namespace: root,
              isResource: true
            });
            flow.js.rootNSFile[root] = rootFile;
            flow.js.fn2ns[rootFile.jsRef] = root;
            token.file = rootFile;
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
            newFile.isResource = true;
            newFile.namespace = namespace;

            flow.js.fn2ns[newFile.jsRef] = namespace;
            token.file = newFile;
            //newFile.package = root;
          }

          //token.file = newFile;

          createScope(newFile, flow, nsToken);

          file.link(newFile, token);
          file.deps.push(newFile);

          token.resourceRef = newFile;
          flow.js.resources.push(token);

          fconsole.incDeep(2);
          processFile(newFile, flow);
          fconsole.decDeep(2);

          token.ref_ = newFile.jsScope.get('module').token.obj.exports;
          token.obj = token.ref_.obj;
        }
        else
        {
          var arg1 = args[1] && args[1][0] == 'string' ? args[1][1] : '';  // TODO: check it
          var filename = utils.resolveToBase(flow, arg0, arg1 || path.dirname(flow.options.file));
          var file = this.file;

          var newFile = flow.files.add({
            filename: filename,
            jsRefCount: 0
          });

          newFile.isResource = true;
          newFile.jsRefCount++;

          file.link(newFile, token);
          file.resources.push(newFile);

          token.resourceRef = newFile;
          flow.js.resources.push(token);

          if (newFile.type == 'script')
          {
            createScope(newFile, flow);

            fconsole.incDeep(2);
            processFile(newFile, flow);
            fconsole.decDeep(2);

            token.ref_ = newFile.jsScope.get('module').token.obj.exports;
            token.obj = token.ref_.obj;
          }
          else
          {
            token.ref_ = ['string', newFile.content];
          }
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

    // basis.Class.create
    // var classRunner = require('./class.js').runner(flow);
    // try {
    //   basisScope.get('Class').token[1][3][10][1][2][1][1][3][1].run = classRunner;
    // } catch(e) {
    //   defineHandler(globalScope, 'basis.Class.create', classRunner);
    // }

    // process ast
    file.ast = at.struct(file.ast, {
      file: file,
      console: fconsole
    });

    //var CLASS_SELF = globalScope.resolve(at.parse('basis.Class.SELF', true));

    // basis.resource
    defineHandler(globalScope, 'basis.resource', getResourceRunner);

    // basis.asset
    defineHandler(globalScope, 'basis.asset', function(token, this_, args){
      //fconsole.log('basis.asset');

      args = token[2]; // FIXME: it's a hack
      var newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, this.file.context, flow, this.file)[0];
      if (newFilename)
      {
        var newFile = flow.files.add({
          filename: basisResolveURI // since 1.4
            ? basisResolveURI(newFilename, null, 'basis.asset(\'{url}\')')
            : newFilename
        });
        this.file.link(newFile, token);

        //file.link(newFile, token);
        newFile.outputContent = newFile.content;
        newFile.outputFilename = flow.outputResourceDir + newFile.digest + newFile.ext;
        newFile.fileRef = newFile.relOutputFilename;

        token.splice(0, token.length, 'string', newFile.fileRef || '');

        return token;
      }
      else
      {
        flow.warn({
          file: this.file.relpath,
          message: 'basis.asset: first argument is not resolved, token: ' + at.translate(token)
        });
      }
    });

    // autoload here because we can't resolve basis.resource before ast.struct
    if (file.autoload)
    {
      var processAutoload = function(ns){
        var autoRequire = at.parse('basis.require("' + ns + '")', true);
        handlers.requireNamespace.call({ file: file }, autoRequire, null, [['string', ns]]);
        return autoRequire;
      };

      flow.js.autoload = !Array.isArray(file.autoload)
        // basis.js prior 1.3.0
        ? processAutoload(file.autoload)
        // basis.js after 1.3.0
        : file.autoload.map(processAutoload);
    }
  }
  else
  {
    // FIXME: temporary here - move to proper place
    if (file.namespace == 'basis.template.htmlfgen')
      flow.tmpl.fgen = file;

    if (file.namespace == 'basis.template')
      require('./tmpl.js')(file, flow, defineHandler);

    // process ast
    file.ast = at.struct(file.ast, {
      file: file,
      console: fconsole
    });

    if (file.nsToken)
    {
      astComplete(file.jsScope, file.nsToken, file.nsToken.obj.exports);
      astExtend(file.jsScope, file.nsToken.obj.exports, file.nsToken.obj.exports);
    }

    // FIXME: temporary here - move to proper place
    if (file.namespace == 'basis.l10n')
    {
      flow.l10n.module = file;

      if (file.jsScope.resolve(at.parse('basis.l10n.dictionary', 1)))
        require('./l10n_v2.js')(file, flow, defineHandler, globalScope);
      else
        require('./l10n_v1.js')(file, flow, defineHandler, globalScope);
    }
  }
}
