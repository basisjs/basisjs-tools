
var errorHandler;

function camelize(name){
  return name.replace(/-(.)/g, function(m, ch){
    return ch.toUpperCase();
  });
}

function returnFirstArg(value){
  return value;
}

function pad(width, str) {
  return str + Array(Math.max(0, width - str.length) + 1).join(' ');
}


/**
* @class
* @param {string} usage
* @param {string} description
*/
var Option = function(usage, description){
  var self = this;

  this.description = description || '';
  this.usage = usage.trim();

  var left = this.usage
    // short usage
    // -x
    .replace(/^-([a-zA-Z])(\s*,\s*|\s+)/, function(m, name){
      self.short = name;

      return '';
    })
    // long usage
    // --flag
    // --no-flag - invert value if flag is boolean
    .replace(/^--(no-)?([a-zA-Z][a-zA-Z0-9\-\_]+)\s*/, function(m, no, name){
      self.name = name;
      self.long = (no || '') + name;
      self.defValue = !!no;

      return '';
    })
    // params
    // <foo> - require one parameter
    // <foo>..<bar> - require more than one parameter
    // [foo] - one optional parameter
    // [foo]..[bar] - 
    .replace(/^(?:<([a-zA-Z][a-zA-Z0-9\-\_]*)>(?:\.\.<([a-zA-Z][a-zA-Z0-9\-\_]*)>)?|\[([a-zA-Z][a-zA-Z0-9\-\_]*)\](?:\.\.\[([a-zA-Z][a-zA-Z0-9\-\_]*)\])?)$/, function(m, req_start, req_end, opt_start, opt_end){
      if (self.defValue)
        self.name = self.long;

      self.defValue = undefined;

      if (req_start)
      {
        self.required = true;
        self.start = req_start;
        self.end = req_end || '';
      }
      else
      {
        self.start = opt_start;
        self.end = opt_end || '';
      }

      if (!self.end)
      {
        self.argCount = 1;
      }
      else
      {
        self.argCount = 2;
        self.normalize = function(){
          return Array.prototype.slice.call(arguments);
        };
      }

      return '';
    });

  if (left)
    throw new Error('Bad usage description for option: ' + this.usage);

  if (!this.long)
    throw new Error('Usage has no long name: ' + this.usage);

  if (!this.name)
    this.name = this.long;

  this.camelName = camelize(this.name);
}

Option.prototype = {
  name: '',
  description: '',
  short: '',
  long: '',
  required: false,
  argCount: 0,
  start: null,
  end: null,
  defValue: undefined,
  normalize: returnFirstArg
};


//
// Command
//

function createOption(usage, description, opt_1, opt_2){
  var option = new Option(usage, description);

  // if (option.bool && arguments.length > 2)
  //   throw new Error('bool flags can\'t has default value or validator');

  if (arguments.length == 3)
  {
    if (typeof opt_1 == 'function')
      option.normalize = opt_1;
    else
      option.defValue = opt_1;
  }

  if (arguments.length == 4)
  {
    if (typeof opt_1 == 'function')
      option.normalize = opt_1;

    option.defValue = opt_2;
  }

  return option;
}

function addOptionToCommand(command, option){
  var commandOption;

  // short
  if (option.short)
  {
    commandOption = command.short[option.short];

    if (commandOption)
      throw new Error('Short option name -' + option.short + ' already in use by ' + commandOption.usage + ' ' + commandOption.description);

    command.short[option.short] = option;
  }

  // long
  commandOption = command.long[option.long];

  if (commandOption)
    throw new Error('Long option --' + option.long + ' already in use by ' + commandOption.usage + ' ' + commandOption.description);

  command.long[option.long] = option;

  // camel
  commandOption = command.options[option.camelName];

  if (commandOption)
    throw new Error('Name option ' + option.camelName + ' already in use by ' + commandOption.usage + ' ' + commandOption.description);

  command.options[option.camelName] = option;

  // set default value
  if (typeof option.defValue != 'undefined')
    command.values[option.camelName] = option.normalize.call(command, option.defValue);

  return option;
}

function findVariants(names, entry, prefix){
  var variants = [];

  for (var name in names)
    if (name.substr(0, entry.length) == entry)
      variants.push((prefix || '') + name);

  return variants;
}

function processArgs(command, args, expects){
  function processOption(option, command){
    var params = [];
    var newValue;

    if (!option)
      throw new Error('Unknown option name: ' + token);

    if (option.argCount)
    {
      for (var j = 0; j < option.argCount; j++)
      {
        var nextToken = args[i + 1];
        if (!nextToken || nextToken[0] == '-')
          break;

        params.push(args[++i]);
      }

      if (option.required && params.length != option.argCount)
        throw new Error('Option ' + token + ' should be used with argument(s)\nUsage: ' + option.usage);

      newValue = option.normalize.apply(command, params);
    }
    else
    {
      newValue = !option.defValue;
      option.normalize.call(command, newValue);
    }

    command.values[option.camelName] = newValue;
  }

  var option;

  for (var i = 0; i < args.length; i++)
  {
    var token = args[i];
    var last = i == args.length - 1;
    //console.log(token);
    if (token[0] == '-')
    {
      if (token[1] == '-')
      {
        // long
        var option = command.long[token.substr(2)];

        //if (!option && token.substr(2, 3) == 'no-')
        //  option = command.long[token.substr(5)];

        if (option)
        {
          // option exists
          processOption(option, command);
        }
        else
        {
          if (last && expects)
            return findVariants(command.long, token, '--');
          else
            throw new Error('Unknown option name: ' + token);
        }
      }
      else
      {
        // short flags sequence
        if (!/^-[a-zA-Z]+$/.test(token))
          throw new Error('Wrong short option name sequence: ' + token);

        if (token.length == 2)
        {
          // single option
          processOption(command.short[token[1]], command);
        }
        else
        {
          // sequence
          for (var j = 1; j < token.length; j++)
          {
            option = command.short[token[j]];

            if (!option)
              throw new Error('Unknown short option name: -' + token[j]);

            if (option.argCount)
              throw new Error('Non-boolean option -' + token[j] + ' can\'t be used in short option sequence: ' + token);

            processOption(option, command);
          }
        }
      }
    }
    else
    {
      if (command.commands[token])
      {
        command = command.commands[token];
        if (command.init_)
          command.init_(command);
      }
      else
      {
        if (last && expects)
          return findVariants(command.commands, token);
        else
          throw new Error('Unknown command: ' + token);
      }
    }
  }

  if (expects)
  {
    // TODO
  }
  else
  {
    if (command.action_)
      command.action_(command);
  }
}

/**
* @class
*/
var Command = function(parent, name, params){
  this.name = name;
  this.parent = parent || null;

  this.short = {};
  this.long = {};
  this.commands = {};

  this.values = {};
  this.options = {};

  this.option('-h, --help', 'Output usage information', function(){
    this.showHelp();
    process.exit(0);
  }, undefined);

  if (params)
    params.trim().replace(/\[\]|<>/);
}

Command.prototype = {
  params: null,
  description_: '',
  version_: '',
  init_: false,
  action_: false,

  option: function(usage, description, opt_1, opt_2){
    addOptionToCommand(this, createOption.apply(null, arguments));

    return this;
  },
  shortcut: function(usage, description, fn, opt_1, opt_2){
    if (typeof fn != 'function')
      throw new Error('fn should be a function');

    var command = this;
    var option = addOptionToCommand(this, createOption(usage, description, opt_1, opt_2));
    var normalize = option.normalize;

    option.normalize = function(value){
      var values;
      
      value = normalize.call(command, value);
      values = fn(value);

      for (var name in values)
        if (values.hasOwnProperty(name))
          command.values[name] = command.options.hasOwnProperty(name)
            ? command.options[name].normalize.call(command, values[name])
            : values[name];

      command.values[option.name] = value;

      return value;
    }

    return this;
  },
  hasOption: function(name){
    return this.options.hasOwnProperty(name);
  },
  hasOptions: function(){
    var count = 0;
    for (var key in this.options)
      if (count++)
        return true;
  },
  setOption: function(name, value){
    if (!this.hasOption(name))
      throw new Error('Option `' + name + '` is not defined');

    this.values[name] = this.options[name].normalize.call(this, value);
  },

  command: function(name, params){
    if (!/^[a-zA-Z][a-zA-Z0-9\-\_]*$/.test(name))
      throw new Error('Wrong command name: ' + name);

    // search for existing one
    var subcommand = this.commands[name];

    if (!subcommand)
    {
      // create new one if not exists
      subcommand = new Command(this, name, params);
      this.commands[name] = subcommand;
    }

    return subcommand;
  },
  hasCommands: function(){
    for (var key in this.commands)
      return true;
  },

  up: function(){
    return this.parent;
  },

  description: function(description){
    if (this.description_)
      throw new Error('Description for command could be set only once');

    this.description_ = description;

    return this;
  },

  version: function(version, usage, description){
    if (this.version_)
      throw new Error('Version for command could be set only once');
    
    this.version_ = version;
    this.option(
      usage || '-v, --version',
      description || 'Output the version',
      function(){
        console.log(this.name, this.version_);
        process.exit(0);
      },
      undefined
    );

    return this;
  },

  init: function(fn){
    if (this.init_)
      throw new Error('Init function for command could be set only once');

    if (typeof fn != 'function')
      throw new Error('Value for init must be a function');

    this.init_ = fn;

    return this;
  },

  action: function(fn){
    if (this.action_)
      throw new Error('Action for command could be set only once');

    if (typeof fn != 'function')
      throw new Error('Value for action must be a function');

    this.action_ = fn;

    return this;
  },

  usage: function(){
    console.log('TODO Command#usage');
    return this;
  },
  on: function(){
    console.log('TODO Command#on');
    return this;
  },

  parse: function(args, expects){
    if (!args)
      args = process.argv.slice(2);

    //console.log(args);

    if (!errorHandler)
      processArgs(this, args, expects);
    else
      try {
        processArgs(this, args, expects);
      } catch(e) {
        errorHandler(e.message || e);
      }
  },

  normalize: function(values){
    var result = {};

    if (!values)
      values = {};

    for (var name in this.values)
      if (this.values.hasOwnProperty(name))
        result[name] = values.hasOwnProperty(name) && this.options.hasOwnProperty(name)
          ? this.options[name].normalize.call(this, values[name])
          : this.values[name];

    for (var name in values)
      if (values.hasOwnProperty(name) && !this.options.hasOwnProperty(name))
        result[name] = values[name];

    return result;
  },

  showHelp: function(){
    console.log(showCommandHelp(this));
  }
};


//
// help
//

/**
 * Return program help documentation.
 *
 * @return {String}
 * @api private
 */

function showCommandHelp(command){
  function commandsHelp(){
    if (!command.hasCommands())
      return '';

    var lines = [];
    for (var name in command.commands)
    {
      var cmd = command.commands[name];
      var args = '';
      /*var args = cmd._args.map(function(arg){
        return arg.required
          ? '<' + arg.name + '>'
          : '[' + arg.name + ']';
      }).join(' ');*/

      lines.push(
        '  ' + 
        pad(22, name + (cmd.hasOptions() ? ' [options]' : '') + ' ' + args) +
        (cmd.description_ ? ' ' + cmd.description_ : '')
      );
    }

    return [
      '',
      'Commands:',
      '',
      lines.join('\n'),
      ''
    ].join('\n');
  }

  function optionsHelp(){
    if (!command.hasOptions())
      return '';

    var options = [];

    for (var key in command.long)
      options.push(command.long[key]);

    var width = options.reduce(function(res, option){
      return Math.max(res, option.usage.length);
    }, 0);
  
    // Prepend the help information
    return [
      '',
      'Options:',
      '',
      options.map(function(option){
        return '  ' + pad(width, option.usage) + '  ' + option.description;
      }).join('\n'),
      ''
    ].join('\n');
  }

  var output = [];

  if (command.description_)
    output.push(command.description_ + '\n');

  output.push(
    'Usage:\n\n  ' + command.name + (command.hasOptions() ? ' [options]' : '') + (command.hasCommands() ? ' [command]' : ''),
    commandsHelp() +
    optionsHelp()
  );

  return output.join('\n');
};

//
// export
//

module.exports = {
  Command: Command,
  Option: Option,

  error: function(fn){
    if (errorHandler)
      throw new Error('Error handler should be set only once');

    if (typeof fn != 'function')
      throw new Error('Error handler should be a function');

    errorHandler = fn;

    return this;
  },

  create: function(name){
    return new Command(null, name || require('path').basename(process.argv[1]) || 'cli')
  }
};
