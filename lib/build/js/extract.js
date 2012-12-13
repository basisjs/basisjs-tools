
var html_at = require('../html/ast_tools');
var at = require('./ast_tools');
var utils = require('../misc/utils');

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
                scriptFile.htmlFile = file;
                scriptFile.basisScript = true;
                scriptFile.basisConfig = attrs[configAttr] || '';
                scriptFile.namespace = 'basis';
                scriptFile.package = 'basis';
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
  // Search for basis.js
  //

  fconsole.start('Search for basis.js');

  for (var i = 0, file; file = queue[i]; i++)
    if (file.type == 'script' && file.basisScript)
    {
      fconsole.log('[OK] basis.js found at path ' + file.relpath);
      flow.js.rootNSFile.basis = file;
      flow.js.basisScript = file.filename;

      //
      // parse basis config
      //

      fconsole.start('Parse config:');
      var config = {};
      try {
        config = Function('return{' + file.basisConfig + '}')();
      } catch(e) {
        fconsole.log('[WARN] basis-config parse fault: ' + e);
      }

      if (!config.path)
        config.path = {};

      for (var key in config.path)
      {
        flow.js.rootBaseURI[key] = file.htmlFile.resolve(config.path[key]) + '/';
        fconsole.log('Path found for ' + key + ': ' + config.path[key] + ' -> ' + flow.js.rootBaseURI[key]);
      }

      if (config.autoload)
      {
        var filename = file.htmlFile.resolve((flow.js.rootBaseURI[config.autoload] || '') + config.autoload + '.js');
        fconsole.log('Autoload for `' + config.autoload + '` found: ' + filename);

        var autoloadFile = flow.files.add({
          filename: filename,  
          namespace: config.autoload,
          package: 'basis'//config.autoload
        });
        createScope(autoloadFile, flow);
        flow.js.rootNSFile[config.autoload] = autoloadFile;
        flow.js.globalScope.put(config.autoload, 'global', {}); // ?? remove
      }

      fconsole.end();

      break;
    }

  if (!flow.js.basisScript)
  {
    fconsole.log('[WARN] basis.js not found (should be a <script> tag with src & basis-config attributes)');
  }

  fconsole.endl();

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



function getFileContext(file){
  return {
    __filename: file.filename || '',
    __dirname: file.baseURI,
    namespace: file.namespace || ''
  };
}

function createScope(file, flow){
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
      module: ['object', [['exports', scope.exports]]],
      exports: scope.exports
    };

    for (var name in names)
      scope.put(name, 'arg', names[name]);

    file.jsScope = scope;
  }
}

function processScript(file, flow){
  var context = getFileContext(file);
  var content = file.content;

  if (flow.options.jsCutDev)
  {
    content = content
      .replace(/;;;.*([\r\n]|$)/g, '')
      .replace(/\/\*\*\s*@cut.*?\*\/.*([\r\n]|$)/g, '');
  }

  // extend file info
  var deps = [];
  var resources = [];

  file.deps = deps;
  file.resources = resources;

  if (file.basisScript)
  {
    var len = flow.js.globalScope.subscopes.length;
  }

  var ast = at.applyScope(at.parse(content), file.jsScope || flow.js.globalScope);

  if (file.basisScript)
  {
    var basisScope = flow.js.globalScope.subscopes.slice(len)[0];

    function astExtend(context, dest, source){
      if (dest && source && source[0] == 'object')
      {
        if (!dest.obj)
          dest.obj = {};
        for (var i = 0, props = source[1], prop; prop = props[i]; i++)
          dest.obj[prop[0]] = context.resolve(prop[1]);
      }
    }
    function createNS(path){
      var token = ['function', path, []];
      token.obj = {
        extend: nsExtend,
        path: path
      };
      return token;
    }

    basisScope.get('extend').token.run = function(token, t, args){
      //console.log('extend', arguments);
      astExtend(this.scope, args[0], args[1]);
    };
    basisScope.get('getNamespace').token.run = function(token, t, args){
      //console.log('getNamespace', arguments);
      var namespace = args[0];
      if (namespace && namespace[0] == 'string')
      {
        var path = namespace[1].split('.');
        var root = path.shift();

        var ns = flow.js.globalScope.get(root);
        if (!ns)
          ns = flow.js.globalScope.put(root, 'ns', createNS(root)).token;
        else
          ns = ns.token;

        for (var i = 0; i < path.length; i++)
        {
          if (!ns.obj[path[i]])
            ns.obj[path[i]] = createNS(path.slice(0, i + 1).join('.'));

          ns = ns.obj[path[i]];
        }

        token.obj = ns.obj;
      }
    };
    var nsExtend = at.createRunner(function(token, t, args){
      astExtend(this.scope, t, args[0]);
      token.obj = t.obj;
    });

    file.ast = at.struct(ast);
  }
  else
  {
    var BASIS_REQUIRE = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'require']) || [];
    var BASIS_RESOURCE = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'resource']) || [];
    var BASIS_ASSET = flow.js.globalScope.resolve(['dot', ['name', 'basis'], 'asset']) || [];
    var RESOURCE = (file.jsScope && file.jsScope.token('resource')) || [];
    //console.log(BASIS_RESOURCE);

    file.ast = at.walk(ast, {
      "call": function(token){
        var expr = token[1];
        var args = token[2];
        var newFilename;
        var newFile;

        switch (this.scope.resolve(expr))
        {
          case BASIS_ASSET:
            newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, context)[0];            
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

          case BASIS_RESOURCE:
            newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, context)[0];
            if (newFilename)
            {
              newFile = flow.files.add({
                filename: newFilename,
                jsRefCount: 0
              });
              newFile.isResource = true;

              createScope(newFile, flow);

              file.link(newFile);
              resources.push(newFile);

              token[2] = [['string', newFile.relpath]];
              token.resourceRef = newFile;
              newFile.jsRefCount++;
            }

            break;

          case RESOURCE:
            newFilename = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, context)[0];
            if (newFilename)
            {
              newFile = flow.files.add({
                filename: file.resolve(newFilename),
                jsRefCount: 0
              });
              newFile.isResource = true;
              createScope(newFile, flow);

              file.link(newFile);
              resources.push(newFile);

              token[1] = ['dot', ['name', 'basis'], 'resource'];
              token[2] = [['string', newFile.relpath]];
              token.resourceRef = newFile;
              newFile.jsRefCount++;
            }

            break;

          case BASIS_REQUIRE:
            namespace = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, context)[0];
            if (namespace)
            {
              var parts = namespace.split(/\./);
              var root = parts[0];
              var rootFile = flow.js.rootNSFile[root];

              if (!rootFile)
              {
                // TODO: resolve filename relative to html file
                var filename = flow.js.rootBaseURI[root] ? path.resolve(flow.js.rootBaseURI[root] + root + '.js') : root + '.js';
                rootFile = flow.files.add({
                  filename: filename,  
                  namespace: root,
                  package: 'basis'//root
                });
                flow.js.rootNSFile[root] = rootFile;
                flow.js.globalScope.put(root, 'global', {}); // ?? remove
              }

              if (root == namespace)
              {
                newFile = rootFile;
              }
              else
              {
                newFile = flow.files.add({
                  filename: rootFile.resolve(parts.join('/') + '.js')
                });
                newFile.namespace = namespace;
                newFile.package = root;
              }

              createScope(newFile, flow);

              file.link(newFile);
              deps.push(newFile);
            }

            break;
        }
      }
    });
  }
}
