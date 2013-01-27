
var fs = require('fs');
var path = require('path');

var moduleOptions = require('./options');
var command = moduleOptions.command;
var replaceTokens = {};

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

  options = moduleOptions.norm(options);

  //
  // init
  //

  var target;
  switch (options.topic)
  {
    case 'app':
    case 'module':
      target = options.topic == 'app' ? options.output : path.join(options.output, options.name);
      if (fs.existsSync(target))
      {
        console.warn('Output folder (' + target + ') is already exists. Delete it first or choose another one.')
        process.exit();
      }

      console.log('Create output folder:', target)
      fs.mkdirSync(target);

      break;

    case 'type':
      options.instanceName = options.name.charAt(0).toLowerCase() + options.name.substr(1);
      target = options.output;
      
      break;
  }


  //
  // run!
  //
  doWork(options.templateDir, [target], {
    appName: options.name, // remove me
    name: options.name,
    instanceName: options.instanceName,
    appTitle: (options.title || 'My app').replace(/\'/g, '\\\''),
    l10n: !!options.l10n
  });
}


//
// tools
//

function replaceSpecial(str, values){
  return str
    // cut
    .replace(/\{\s*(!!?)\s*([a-z\d_]+)\s*\}(.*(?:\r\n?|\n\r?|$))/ig, function(m, op, name, rest){
      return (op == '!' ? !values[name] : !!values[name]) ? rest : '';
    })
    // set value
    .replace(/\{\s*([a-z\d_]+)\s*\}/ig, function(m, name){
      if (name in values == false)
      {
        console.warn('unknown replace token:', name);
        return m;
      }
      else
        return values[name];
    });
}

function indent(level){
  var res = [];
  for (var i = 0; i < level; i++)
    res.push('  ');
  return res.join('');
}

function doWork(input, output, values){
  var list = fs.readdirSync(input);
  for (var i = 0, fn; fn = list[i]; i++)
  {
    var infn = input + '/' + fn;
    var outputfn = replaceSpecial(fn, values);
    var stat = fs.statSync(infn);

    if (!outputfn)
      continue;

    output.push(outputfn);

    if (stat.isDirectory())
    {
      console.log(indent(output.length) + 'Create path:', output.slice(1).join('/'));
      fs.mkdirSync(output.join('/'));
      doWork(infn, output, values);
    }
    else
    {
      console.log(indent(output.length) + 'Create file:', output.slice(1).join('/'));
      fs.writeFileSync(output.join('/'), replaceSpecial(fs.readFileSync(infn, 'utf-8'), values));
    }

    output.pop(outputfn);
  }
}