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
  globalScope.put('global', '?', '?');

  flow.js = {
    globalScope: globalScope,
    rootBaseURI: {},
    rootNSFile: {},
    getFileContext: getFileContext,
    fn: []
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
    if (file.type == 'script')
    {
      fconsole.start(file.relpath);

      processScript(file, flow);

      fconsole.endl();
    }
  fconsole.endl();
};

module.exports.handlerName = '[js] Extract';


//
// main part
//


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
    fconsole.log('    * Autoload for `' + config.autoload + '` found: ' + file.htmlFile.resolve((flow.js.rootBaseURI[config.autoload] || '') + config.autoload + '.js'));
    html_at.insertAfter(file.htmlNode, {
      type: 'tag',
      name: 'script',
      children: [{
        type: 'text',
        data: 'basis.require("' + config.autoload + '");'
      }]
    });
  }

  fconsole.end();
}

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
    var thisObject = file.namespace
      ? { type: 'module', names: { path: ['string', file.namespace] } }
      : { type: 'resource' };

    var scope = new at.Scope('function', flow.js.globalScope);
    scope.exports = ['object', []];

    var names = {
      __filename: ['string', file.relpath],
      __dirname: ['string', file.baseURI],
      global: '?', //flow.js.globalScope,
      //basis: '?',
      resource: ['function', null, []],
      module: module || ['object', [['exports', scope.exports]]],
      exports: scope.exports
    };

    for (var name in names)
      scope.put(name, 'arg', names[name]);

    file.jsScope = scope;
  }
}

function defineHandler(scope, name, fn){
  var symbol = scope.get(name);

  if (!symbol)
  {
    console.warn('symbol ' + name + ' is not resolved in specified scope');
    return;
  }

  symbol.token = at.createRunner(fn);

  return fn;
}

function processScript(file, flow){
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


  var content = file.content;
  var globalScope = flow.js.globalScope;

  if (flow.options.jsCutDev)
  {
    content = content
      .replace(/;;;.*([\r\n]|$)/g, '')
      .replace(/\/\*\*\s*@cut.*?\*\/.*([\r\n]|$)/g, '');
  }

  // extend file info
  file.context = getFileContext(file);
  file.deps = [];
  file.resources = [];

  // parse and apply scope
  var ast = at.applyScope(at.parse(content), file.jsScope || globalScope);

  if (file.basisScript)
  {
    var basisScope = ast.scope.subscopes[0];

    var nsExtend = at.createRunner(function(token, this_, args){
      astExtend(this.scope, this_, args[0]);
      token.obj = this_.obj;
    });

    var createNS = function(path){
      var token = ['function', path, []];
      token.obj = {
        extend: nsExtend,
        path: path
      };
      return token;
    };

    var getNamespace = function(namespace){
      var path = namespace.split('.');
      var root = path.shift();
      var ns = globalScope.get(root);

      if (!ns)
        ns = globalScope.put(root, 'ns', createNS(root)).token;
      else
        ns = ns.token;

      for (var i = 0; i < path.length; i++)
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
        //console.log('extend', arguments);
        astExtend(this.scope, args[0], args[1]);
      },

      // basis.object.complete
      complete: function(token, this_, args){
        //console.log('comlete', arguments);
        astComplete(this.scope, args[0], args[1]);
      },

      // basis.namespace
      getNamespace: function(token, this_, args){
        //console.log('getNamespace', arguments);
        var namespace = args[0];
        if (namespace && namespace[0] == 'string')
          token.obj = getNamespace(namespace[1]).obj;
      },

      // basis.require
      requireNamespace: function(token, this_, args){
        //console.log('requireNamespace', arguments);
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
        }
      },
      fetchResourceFunction: function(token, this_, args){
        //console.log('basis.resource');

        if (!args[0])
        {
          //console.log('basis.resource', arguments);
          return;
        }

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

          token[2] = [['string', newFile.relpath]];
          token.resourceRef = newFile;
          newFile.jsRefCount++;
        }
      }/*,
      asset: function(token, this_, args){
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
      }*/
    };

    for (var key in handlers)
      defineHandler(basisScope, key, handlers[key]);

    file.ast = at.struct(ast, {
      file: file
    });
  }
  else
  {
    //var BASIS_REQUIRE = globalScope.resolve(['dot', ['name', 'basis'], 'require']) || [];
    //var BASIS_RESOURCE = globalScope.resolve(['dot', ['name', 'basis'], 'resource']) || [];
    var BASIS_ASSET = globalScope.resolve(['dot', ['name', 'basis'], 'asset']) || [];
    var RESOURCE = (file.jsScope && file.jsScope.token('resource')) || [];

    file.ast = at.struct(at.walk(ast, {
      "call": function(token){
        var expr = token[1];
        var args = token[2];
        var newFilename;
        var newFile;

        switch (this.scope.resolve(expr))
        {
          case BASIS_ASSET:
            newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, file.context)[0];
            if (newFilename)
            {
              newFile = flow.files.add({
                filename: newFilename
              });
              //file.link(newFile);
              newFile.outputContent = newFile.content;
              newFile.outputFilename = flow.outputResourceDir + newFile.digest + newFile.ext;
              newFile.fileRef = newFile.relOutputFilename;

              token.splice(0, token.length, 'string', newFile.fileRef || '');
              return token;
            }
            break;

          case RESOURCE:
            newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, file.context)[0];
            if (newFilename)
            {
              /*newFile = flow.files.add({
                filename: file.resolve(newFilename),
                jsRefCount: 0
              });
              newFile.isResource = true;
              createScope(newFile, flow);

              file.link(newFile);
              file.resources.push(newFile);*/

              token[1] = ['dot', ['name', 'basis'], 'resource'];
              token[2] = [['string', file.resolve(newFilename)]];
              //token.resourceRef = newFile;
              //newFile.jsRefCount++;
            }

            break;
        }
      }
    }), {
      file: file
    });

    if (file.nsToken)
      astComplete(file.jsScope, file.nsToken, file.nsToken.obj.exports);
  }
}
