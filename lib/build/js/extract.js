'use strict';

var html_at = require('../html/ast_tools');
var at = require('./ast_tools');
var utils = require('../misc/utils');
var path = require('path');

var NON_WHITESPACE = /[^\s\r\n]/;

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
  globalToken.obj = globalScope.names;
  //globalScope.put('__resources__', 'hz', ['object', []]);

  flow.js = {
    globalScope: globalScope,
    rootBaseURI: {},
    rootNSFile: {},
    getFileContext: getFileContext,
    fn: []
    //resources: {}
  };


  //
  // Scan html files for scripts
  //

  fconsole.start('Scan html files for scripts');

  var scriptSequenceId = 0;
  var inSequence = false;
  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.start(file.relpath);

      html_at.walk(file.ast, {
        '*': function(node){
          // nothing to do if text node contains whitespace only
          if (node.type == 'text' && !NON_WHITESPACE.test(node.data))
            return;

          // scripts with src continue script sequence
          if (node.type == 'tag' && node.name == 'script')
            return;

          scriptSequenceId += inSequence;
          inSequence = false;
        },
        'tag': function(node){
          if (node.name != 'script')
            return;

          var attrs = html_at.getAttrs(node);

          // ignore <script> tags with type other than text/javascript
          if (attrs.type && attrs.type != 'text/javascript')
          {
            fconsole.log('[!] <script> with unknown type `' + attrs.type + '` ignored\n');
            return;
          }

          // external script
          if (attrs.src)
          {
            var uri = utils.resolveUri(attrs.src);

            if (uri.filename)
            {
              fconsole.start('External script found: <script src="' + attrs.src + '">');
              inSequence = true;

              var scriptFile = flow.files.add({
                htmlNode: node,
                type: 'script',
                filename: file.resolve(attrs.src),
                package: 'script' + (scriptSequenceId || '')
              });

              if (!scriptFile)
                return;

              file.link(scriptFile);

              var configAttr;

              if (attrs.hasOwnProperty('data-basis-config'))
                configAttr = 'data-basis-config';
              else
                if (attrs.hasOwnProperty('basis-config'))
                  configAttr = 'basis-config';

              if (configAttr)
              {
                fconsole.log('[i] basis.js marker found (basis-config attribute)');
                processBasisFile(flow, scriptFile, file, attrs[configAttr] || '');
              }

              fconsole.endl();
            }
            else if (uri.mime == 'text/javascript')
            {
              fconsole.start('Inline script with data uri found');
              inSequence = true;

              var scriptFile = flow.files.add({
                htmlNode: node,
                type: 'script',
                inline: true,
                baseURI: file.baseURI,
                content: uri.content,
                package: 'script' + (scriptSequenceId || '')
              })

              if (attrs['build-filename'])
                scriptFile.sourceFilename = attrs['build-filename'];

              file.link(scriptFile);

              fconsole.endl();
            }
            else
            {
              fconsole.log('[!] script ignored: ' + html_at.translate(node) + '\n');
            }
          }
          else
          {
            fconsole.log('Inline script found\n');

            file.link(flow.files.add({
              htmlNode: node,
              type: 'script',
              inline: true,
              baseURI: file.baseURI,
              content: html_at.getText(node)
            }));
          }
        }
      });

      fconsole.endl();
    }
  }

  fconsole.endl();


  //
  // Check for basis.js
  //

  if (!flow.js.basisScript)
  {
    fconsole.log('[WARN] basis.js not found (should be a <script> tag with src & basis-config attributes)');
  }

  //
  // Process files
  //

  fconsole.start('Process scripts');
  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && !file.ast)
    {
      fconsole.start(file.relpath);

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

    var basisResource = flow.js.globalScope.resolve(at.parse('basis.resource', 1));
    var names = {
      __filename: ['string', file.relpath],
      __dirname: ['string', file.baseURI],
      //global: '?', //flow.js.globalScope,
      //basis: '?',
      resource: at.createRunner(function(token, this_, args){
        args = token[2]; // FIXME: it's a hack
        var uri = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, file.context)[0];
        if (uri)
        {
          token[1] = ['dot', ['name', 'basis'], 'resource'];
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
    for (var i = 0, props = source[1], prop; prop = props[i]; i++)
      dest.obj[prop[0]] = scope.resolve(prop[1]);
  }
}

function astComplete(scope, dest, source){
  if (dest && source && source[0] == 'object')
  {
    if (!dest.obj)
      dest.obj = {};
    for (var i = 0, props = source[1], prop; prop = props[i]; i++)
      if (prop[0] in dest.obj == false)
        dest.obj[prop[0]] = scope.resolve(prop[1]);
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
    content = content.replace(/(;;;|\/\*\*\s*@cut.*?\*\/).*([\r\n]|$)/g, '');

  // extend file info
  file.context = getFileContext(file);
  file.deps = [];
  file.resources = [];

  // parse and apply scope
  try {
    file.ast = at.applyScope(at.parse(content), file.jsScope || globalScope);
  } catch(e) {
    console.warn('[FATAL ERROR] Parse error of ' + file.relpath + ': ' + (e.message || e));
    process.exit();
  }

  if (file.basisScript)
  {
    // get last global subscope as basis scope
    var basisScope = file.ast.scope.subscopes.slice(-1)[0];
    file.jsScope = basisScope;

    var nsExtend = at.createRunner(function(token, this_, args){
      astExtend(this.scope, this_, args[0]);
      token.obj = this_.obj;
    });

    var createNS = function(path){
      var token = ['function', path, []];
      token.obj = {
        extend: nsExtend,
        path: ['string', path]
      };
      return token;
    };

    var resourceMap = {};
    var createResource = function(uri, resourceFile){
      if (resourceMap[uri])
        return resourceMap[uri];

      function createFetchMethod(methodName){
        return function(){
          //fconsole.log(methodName, this.file.jsScope === this.scope, uri, this.file.relpath, !!resourceFile.deps);
          if (this.file.jsScope === this.scope)
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

    var getNamespace = function(namespace){
      var path = namespace.split('.');
      var root = path[0];
      var ns = globalScope.get(root);

      if (!ns)
        ns = globalScope.put(root, 'ns', createNS(root)).token;
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

    var handlers = {
      // basis.object.extend
      extend: function(token, this_, args){
        //fconsole.log('extend', arguments);
        astExtend(this.scope, args[0], args[1]);
      },

      // basis.object.complete
      complete: function(token, this_, args){
        //fconsole.log('comlete', arguments);
        astComplete(this.scope, args[0], args[1]);
      },

      // basis.namespace
      getNamespace: function(token, this_, args){
        //fconsole.log('getNamespace', arguments);
        var namespace = args[0];
        if (namespace && namespace[0] == 'string')
          token.obj = getNamespace(namespace[1]).obj;
      },

      // basis.require
      requireNamespace: function(token, this_, args){
        //fconsole.log('requireNamespace', arguments);
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

    file.ast = at.struct(file.ast, {
      file: file
    });

    if (file.nsToken)
      astComplete(file.jsScope, file.nsToken, file.nsToken.obj.exports);

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

function processBasisFile(flow, file, htmlFile, attrValue){
  var fconsole = flow.console;

  file.htmlFile = htmlFile;
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
      fconsole.log('    * Autoload for `' + config.autoload + '` found: ' + (flow.js.rootBaseURI[config.autoload] || file.htmlFile.baseURI) + config.autoload + '.js');
      html_at.insertAfter(file.htmlNode, {
        type: 'tag',
        name: 'script',
        children: [{
          type: 'text',
          data: 'basis.require("' + config.autoload + '");'
        }]
      });
    }
  }
  else
    fconsole.log('    <config is empty>');

  fconsole.end();
}
