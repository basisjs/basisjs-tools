
var fs = require('fs');
var path = require('path');

var moduleOptions = require('./options');
var command = moduleOptions.command;

//
// export
//

exports.create = create;
exports.options = moduleOptions;
exports.command = function(args, config){
  return command(args, config, create);
};

//
// if launched directly, run builder
//
if (process.mainModule === module)
  command(null, null, create);

//
// main function
//

function create(options){

  //
  // init
  //

  options = moduleOptions.norm(options);

  if (fs.existsSync(options.output))
  {
  	console.warn('Output folder (' + options.output + ') is already exists. Delete it first or choose another one.')
  	process.exit();
  }

  console.log('Create output folder:', options.output)
  fs.mkdirSync(options.output);

  var replaceTokens = {
    appName: options.name,
    appTitle: (options.title || 'My app').replace(/\'/g, '\\\'')
  };

  //
  // tools
  //

  function replaceSpecial(str){
    return str.replace(/\{([a-z]+)\}/ig, function(m, name){
      var value = replaceTokens[name];
      if (!value)
      {
        console.warn('unknown replace token:', name);
        //process.exit();
      }
      return value || m;
    });
  }

  function indent(level){
    var res = [];
    for (var i = 0; i < level; i++)
      res.push('  ');
    return res.join('');
  }

  function translateDir(inpath, outputPath, level){
    var list = fs.readdirSync(inpath);
    for (var i = 0, fn; fn = list[i]; i++)
    {
      var infn = inpath + '/' + fn;
      var outputfn = outputPath + '/' + replaceSpecial(fn);
      var stat = fs.statSync(infn);

      if (stat.isDirectory())
      {
        console.log(indent(level) + 'Create path:', path.relative(options.output, outputfn));
        fs.mkdirSync(outputfn);
        translateDir(infn, outputfn, level + 1);
      }
      else
      {
        console.log(indent(level) + 'Create file:', path.relative(options.output, outputfn));
        fs.writeFileSync(outputfn, replaceSpecial(fs.readFileSync(infn, 'utf-8')));
      }
    }
  }

  //
  // run!
  //
  translateDir(__dirname + '/proto', options.output, 0);
}
