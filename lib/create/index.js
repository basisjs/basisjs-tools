
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

  console.log('Create file structure:');
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

      if (!fs.existsSync(target))
      {
        console.warn('Destination folder (' + target + ') does not exists.')
        process.exit();
      }
      
      break;
  }


  //
  // create file structure
  //

  createFiles(options.templateDir, [target], {
    type: options.type,
    appName: options.topic == 'app' ? options.name : options.appName,
    name: options.name,
    instanceName: options.instanceName,
    appTitle: (options.title || 'My app').replace(/\'/g, '\\\''),
    l10n: !!options.l10n
  });


  //
  // git
  //

  if (options.topic == 'app' && options.git)
  {
    console.log('\nClone basis.js repo');
    cloneBasis(target + '/lib/basisjs');
  }
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
    .replace(/\{\s*=\s*([a-z\d_]+)\s*\}/ig, function(m, name){
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

function createFiles(input, output, values){
  var list = fs.readdirSync(input);
  for (var i = 0, fn; fn = list[i]; i++)
  {
    var infn = input + '/' + fn;
    var outputfn = replaceSpecial(fn, values);
    var stat = fs.statSync(infn);

    if (!outputfn)
      continue;

    output.push(outputfn);
    outputfn = output.join('/');

    if (fs.existsSync(outputfn))
    {
      console.warn('[ERROR] '.red + outputfn + ' already exists');
      process.exit();
    }

    if (stat.isDirectory())
    {
      console.log(indent(output.length - 1)/* + 'Create path:'*/, output.slice(1).join('/'));
      fs.mkdirSync(outputfn);
      createFiles(infn, output, values);
    }
    else
    {
      console.log(indent(output.length - 1)/* + 'Create file:'*/, output.slice(1).join('/'));
      fs.writeFileSync(outputfn, replaceSpecial(fs.readFileSync(infn, 'utf-8'), values));
    }

    output.pop();
  }
}

function cloneBasis(path){
  require('child_process').spawn(
    'git',
    ['clone', 'http://github.com/basisjs/basisjs', path],
    { stdio: 'inherit' }
  ).on('exit', function (code) {
    if (code)
      console.log('\nSome problems here, git exited with code', code);
  });
}

