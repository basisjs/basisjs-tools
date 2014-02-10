
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

function noop(){
  // nothing todo
}

function parseParams(str, multiple){
  // params [..<required>] [..[optional]]
  // <foo> - require
  // [foo] - optional
  var left = str.trim();
  var result = {
    minArgsCount: 0,
    maxArgsCount: 0,
    args: []
  };

  do {
    tmp = left;
    left = left.replace(/^<([a-zA-Z][a-zA-Z0-9\-\_]*)>\s*/, function(m, name){
      result.args.push(new Argument(name, true));
      result.minArgsCount++;
      result.maxArgsCount++;

      return '';
    });
  } while (tmp != left);

  do {
    tmp = left;
    left = left.replace(/^\[([a-zA-Z][a-zA-Z0-9\-\_]*)\]\s*/, function(m, name){
      result.args.push(new Argument(name, false));
      result.maxArgsCount++;

      return '';
    });
  } while (tmp != left);

  if (left)
    throw new Error('Bad parameter description: ' + str);

  return result.args.length ? result : false;
}

/**
*
*/
var Argument = function(name, required){
  this.name = name;
  this.required = required;
};
Argument.prototype = {
  required: false,
  name: '',
  normalize: returnFirstArg,
  suggest: function(){
    return [];
  }
};

/**
* @class
* @param {string} usage
* @param {string} description
*/
var Option = function(usage, description){
  var self = this;
  var params;  
  var left = usage.trim()
    // short usage
    // -x
    .replace(/^-([a-zA-Z])(?:\s*,\s*|\s+)/, function(m, name){
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
    });

  if (!this.long)
    throw new Error('Usage has no long name: ' + usage);

  try {
    params = parseParams(left);
  } catch(e) {
    console.log(e.message);
    throw new Error('Bad paramenter description in usage for option: ' + usage);
  }

  if (params)
  {
    left = '';
    this.name = this.long;
    this.defValue = undefined;

    for (var key in params)
      if (params.hasOwnProperty(key))
        this[key] = params[key];
  }

  if (left)
    throw new Error('Bad usage description for option: ' + usage);

  if (!this.name)
    this.name = this.long;

  this.description = description || '';
  this.usage = usage.trim();
  this.camelName = camelize(this.name);
}

Option.prototype = {
  name: '',
  description: '',
  short: '',
  long: '',

  required: false,
  minArgsCount: 0,
  maxArgsCount: 0,
  args: null,
  
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
    command.setOption(option.camelName, option.defValue);

  // add to suggestions
  command.suggestions.push('--' + option.long);

  return option;
}

function findVariants(obj, entry){
  return obj.suggestions.filter(function(item){
    return item.substr(0, entry.length) == entry;
  });
}

function processArgs(command, args, suggest){
  function processOption(option, command){
    var params = [];

    if (!option)
      throw new Error('Unknown option name: ' + token);

    if (option.maxArgsCount)
    {
      for (var j = 0; j < option.maxArgsCount; j++)
      {
        var nextToken = args[i + 1];

        if (!nextToken || nextToken[0] == '-')
          break;

        params.push(args[++i]);
      }

      if (params.length < option.minArgsCount)
        throw new Error('Option ' + token + ' should be used with at least ' + option.minArgsCount + ' argument(s)\nUsage: ' + option.usage);
    }
    else
    {
      params = !option.defValue;
    }

    //command.values[option.camelName] = newValue;
    resultToken.options.push({
      option: option,
      value: params
    });
  }

  var resultToken = {
    command: command,
    args: [],
    literalArgs: [],
    options: []
  };
  var result = [resultToken];

  var collectArgs = false;
  var commandArgs = [];
  var noOptionsYet = true;
  var option;

  for (var i = 0; i < args.length; i++)
  {
    var suggestPoint = suggest && i == args.length - 1;
    var token = args[i];

    if (collectArgs)
    {
      commandArgs.push(token);
      continue;
    }

    if (suggestPoint)
    {
      if (token == '')
        break; // returns long option & command list outside the loop
      if (token == '-' || token == '--')
        return findVariants(command, '--');
    }

    if (token == '--')
    {
      noOptionsYet = false;
      collectArgs = true;
      continue;
    }

    if (token[0] == '-')
    {
      noOptionsYet = false;

      if (commandArgs.length)
      {
        command.args_.apply(command, commandArgs);
        commandArgs = [];
      }

      if (token[1] == '-')
      {
        // long option
        option = command.long[token.substr(2)];

        if (!option)
        {
          // option doesn't exist
          if (suggestPoint)
            return findVariants(command, token);
          else
            throw new Error('Unknown option: ' + token);
        }

        // process option
        processOption(option, command);
      }
      else
      {
        // short flags sequence
        if (!/^-[a-zA-Z]+$/.test(token))
          throw new Error('Wrong short option sequence: ' + token);

        if (token.length == 2)
        {
          option = command.short[token[1]];

          if (!option)
            throw new Error('Unknown short option name: -' + token[j]);

          // single option
          processOption(option, command);
        }
        else
        {
          // sequence
          for (var j = 1; j < token.length; j++)
          {
            option = command.short[token[j]];

            if (!option)
              throw new Error('Unknown short option name: -' + token[j]);

            if (option.maxArgsCount)
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
        // switch control to another command
        command = command.commands[token];
        noOptionsYet = true;

        resultToken = {
          command: command,
          args: [],
          literalArgs: [],
          options: []
        };
        result.push(resultToken);
      }
      else
      {
        if (noOptionsYet && command.params && commandArgs.length < command.params.maxArgsCount)
        {
          commandArgs.push(token);
          continue;
        }

        if (suggestPoint)
          return findVariants(command, token);
        else
          throw new Error('Unknown command: ' + token);
      }
    }
  }

  if (suggest)
  {
    if (collectArgs)
      return;

    return findVariants(command, '');
  }
  else
  {
    if (!noOptionsYet)
      resultToken.literalArgs = commandArgs;
    else
      resultToken.args = commandArgs;
  }

  return result;
}

/**
* @class
*/
var Command = function(name, params){
  this.name = name;
  this.params = false;

  try {
    if (params)
      this.params = parseParams(params);
  } catch(e) {
    throw new Error('Bad paramenter description in command definition: ' + this.name + ' ' + params);
  }

  this.commands = {};

  this.options = {};
  this.short = {};
  this.long = {};
  this.values = {};

  this.suggestions = [];

  this.option('-h, --help', 'Output usage information', function(){
    this.showHelp();
    process.exit(0);
  }, undefined);
}

Command.prototype = {
  params: null,
  commands: null,
  options: null,
  short: null,
  long: null,
  values: null,
  suggestions: null,

  description_: '',
  version_: '',
  init_: noop,
  delegate_: noop,
  action_: noop,
  args_: noop,

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
          if (command.options.hasOwnProperty(name))
            command.setOption(name, values[name]);
          else
            command.values[name] = values[name];

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

    var option = this.options[name];
    var newValue = Array.isArray(value)
          ? option.normalize.apply(this, value)
          : option.normalize.call(this, value);

    this.values[name] = option.maxArgsCount ? newValue : value;
  },
  setOptions: function(values){
    for (var name in values)
      if (values.hasOwnProperty(name) && this.hasOption(name))
        this.setOption(name, values[name]);
  },

  command: function(nameOrCommand, params){
    var name;
    var command;

    if (nameOrCommand instanceof Command)
    {
      command = nameOrCommand;
      name = command.name;
    }
    else
    {
      name = nameOrCommand;

      if (!/^[a-zA-Z][a-zA-Z0-9\-\_]*$/.test(name))
        throw new Error('Wrong command name: ' + name);
    }

    // search for existing one
    var subcommand = this.commands[name];

    if (!subcommand)
    {
      // create new one if not exists
      subcommand = command || new Command(name, params);
      this.commands[name] = subcommand;
      this.suggestions.push(name);
    }

    return subcommand;
  },
  hasCommands: function(){
    for (var key in this.commands)
      return true;
  },

  version: function(version, usage, description){
    if (this.version_)
      throw new Error('Version for command could be set only once');
    
    this.version_ = version;
    this.option(
      usage || '-v, --version',
      description || 'Output the version',
      function(){
        console.log(this.version_);
        process.exit(0);
      },
      undefined
    );

    return this;
  },
  description: function(description){
    if (this.description_)
      throw new Error('Description for command could be set only once');

    this.description_ = description;

    return this;
  },

  init: function(fn){
    if (this.init_ !== noop)
      throw new Error('Init function for command could be set only once');

    if (typeof fn != 'function')
      throw new Error('Value for init should be a function');

    this.init_ = fn;

    return this;
  },
  args: function(fn){
    if (this.args_ !== noop)
      throw new Error('Arguments handler for command could be set only once');

    if (typeof fn != 'function')
      throw new Error('Value for arguments handler should be a function');

    this.args_ = fn;

    return this;
  },
  delegate: function(fn){
    if (this.delegate_ !== noop)
      throw new Error('Delegate function could be set only once');

    if (typeof fn != 'function')
      throw new Error('Value for delegate should be a function');

    this.delegate_ = fn;

    return this;
  },
  action: function(fn){
    if (this.action_ !== noop)
      throw new Error('Action for command could be set only once');

    if (typeof fn != 'function')
      throw new Error('Value for action should be a function');

    this.action_ = fn;

    return this;
  },

  parse: function(args, suggest){
    var suggestions;

    if (!args)
      args = process.argv.slice(2);

    //console.log(args);

    if (!errorHandler)
      return processArgs(this, args, suggest);
    else
      try {
        return processArgs(this, args, suggest);
      } catch(e) {
        errorHandler(e.message || e);
      }
  },
  run: function(args){
    var commands = this.parse(args);

    if (!commands)
      return;

    var prevCommand;
    for (var i = 0; i < commands.length; i++)
    {
      var item = commands[i];
      var command = item.command;

      if (prevCommand)
        prevCommand.delegate_(command);

      command.init_(item.args);

      if (item.args.length)
        command.args_(item.args);

      command.setOptions(item.options.reduce(function(res, optionItem){
        res[optionItem.option.camelName] = optionItem.value;
        return res;
      }, {}));

      if (i == commands.length - 1)
        command.action_(item.args, item.literalArgs)
      else
        prevCommand = command;
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

  create: function(name, params){
    return new Command(name || require('path').basename(process.argv[1]) || 'cli', params);
  },

  confirm: function(message, fn){
    process.stdout.write(message);
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', function(val){
      process.stdin.pause();
      fn(/^y|yes|ok|true$/i.test(val.trim()));
    });
    process.stdin.resume();
  }
};
