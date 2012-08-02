
var html_at = require('../html/ast_tools');
var at = require('./ast_tools');

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
    rootNSFile: {},
    getFileContext: getFileContext,
    fn: []
  };


  //
  // Scan html files for scripts
  //

  fconsole.start('Scan html files for scripts');

  for (var i = 0, file; file = queue[i]; i++)
  {
    if (file.type == 'html')
    {
      fconsole.start(file.relpath);

      html_at.walk(file.ast, {
        tag: function(node){
          if (node.name != 'script')
            return;

          var attrs = html_at.getAttrs(node);

          // ignore <script> tags with type other than text/javascript
          if (attrs.type && attrs.type != 'text/javascript')
          {
            fconsole.log('[!] <script> with type ' + attrs.type + ' ignored');
            return;
          }

          // external script
          if (attrs.src)
          {
            fconsole.log('External script found: <script src="' + attrs.src + '">');

            var scriptFile = flow.files.add({
              htmlNode: node,
              type: 'script',
              filename: file.resolve(attrs.src)
            });

            file.link(scriptFile);

            if (attrs.hasOwnProperty('basis-config'))
            {
              fconsole.log('[i] basis.js marker found (basis-config attribute)');
              scriptFile.basisScript = true;
              scriptFile.basisConfig = attrs['basis-config'];
              scriptFile.namespace = 'basis';
            }
          }
          else
          {
            fconsole.log('Inline script found');

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
      fconsole.log('[OK] basis.js found at path ' + file.relPath);
      flow.js.rootNSFile.basis = file;
      flow.js.basisScript = file.filename;
      break;
    }

  if (!flow.js.basisScript)
  {
    fconsole.log('[FAULT] basis.js not found (should be a <script> tag with src & basis-config attributes)');
    process.exit();
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

      if (file.basisScript)
        globalScope.put('basis', 'global');

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
      resource: '?',
      module: ['object', [['exports', scope.exports]]],
      exports: scope.exports
    };

    for (var name in names)
      scope.put(name, 'arg', null, names[name]);

    file.jsScope = scope;
  }
}

function processScript(file, flow){
  var context = getFileContext(file);
  var content = file.content;

  if (flow.options.buildMode)
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

    at.struct(ast);

    /*console.log(basisScope.get('basis').token.obj.Class.obj);
    var ast = at.parse('basis.Class.create', true);
    debugger;
    
    var res = basisScope.resolve(ast)
    console.log('>>>', res);*/

    //process.exit();
  }
 
  file.ast = at.walk(ast, {
    "call": function(token){
      var expr = token[1];
      var args = token[2];
      var newFilename;
      var newFile;

      switch (at.resolveName(expr, true))
      {
        case 'basis.resource':
          if (this.scope.isGlobal('basis'))
          {
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
          }

          break;

        case 'resource':
          if (this.scope.get('resource') === file.jsScope.get('resource'))
          {
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
          }

          break;

        case 'basis.require':
          if (this.scope.isGlobal('basis'))
          {
            namespace = args[0][0] == 'string' ? args[0][1] : at.getCallArgs(args, context)[0];
            //console.log('basis.require call found:', translateCallExpr(expr, args));
            if (namespace)
            {
              var parts = namespace.split(/\./);
              var root = parts[0];
              var rootFile = flow.js.rootNSFile[root];

              if (!rootFile)
              {
                rootFile = flow.files.add({
                  filename: root + '.js',  // TODO: resolve relative to html file
                  namespace: namespace,
                  package: root
                });
                flow.js.rootNSFile[root] = rootFile;

                flow.js.globalScope.put(root, 'global', {});
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
          }

          break;
      }
    }
  });
}
