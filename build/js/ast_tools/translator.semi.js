var ast_walker = require('./walker').ast_walker;

var SpecialSymbol = /^[\[\]\(\)\{\}\=\-\+\*\/\~\%\.\,\!\<\>\?\&\|\^\"\'\:\;]/;

var OPERATORS = ["in", "instanceof", "typeof", "new", "void", "delete", "++", "--", "+", "-", "!", "~", "&", "|", "^", "*", "/", "%", ">>", "<<", ">>>", "<", ">", "<=", ">=", "==", "===", "!=", "!==", "?", "=", "+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&=", "&&", "||"].reduce(function(res, key){ res[key] = true; return res }, {});
var KEYWORDS = ["break", "case", "catch", "const", "continue", "debugger", "default", "delete", "do", "else", "finally", "for", "function", "if", "in", "instanceof", "new", "return", "switch", "throw", "try", "typeof", "var", "void", "while", "with"];
var RESERVED_WORDS = ["abstract", "boolean", "byte", "char", "class", "double", "enum", "export", "extends", "final", "float", "goto", "implements", "import", "int", "interface", "long", "native", "package", "private", "protected", "public", "short", "static", "super", "synchronized", "throws", "transient", "volatile"];
var KEYWORDS_ATOM = ["false", "null", "true", "undefined"];

var ASSIGN_CONDITIONAL_SEQ = { "assign": true, "conditional": true, "seq": true };

var PRECEDENCE = (function(a, ret){
        for (var i = 0, n = 1; i < a.length; ++i, ++n) {
                var b = a[i];
                for (var j = 0; j < b.length; ++j) {
                        ret[b[j]] = n;
                }
        }
        return ret;
})(
        [
                ["||"],
                ["&&"],
                ["|"],
                ["^"],
                ["&"],
                ["==", "===", "!=", "!=="],
                ["<", ">", "<=", ">=", "in", "instanceof"],
                [">>", "<<", ">>>"],
                ["+", "-"],
                ["*", "/", "%"]
        ],
        {}
);

var INDENTINFIER_EXCLUDE = { 'this': true };
[KEYWORDS_ATOM, RESERVED_WORDS, KEYWORDS].forEach(function(keys){
  keys.forEach(function(key){
    INDENTINFIER_EXCLUDE[key] = true;
  })
});

function is_identifier(name) {
  return /^[a-z_$][a-z0-9_$]*$/i.test(name)  //
         && !INDENTINFIER_EXCLUDE.hasOwnProperty(name);
};

var ascii_zero = '\\u0000';
function to_ascii(str) {
  return str.replace(/[\u0080-\uffff]/g, function(ch){
    var code = ch.charCodeAt(0).toString(16);
    return ascii_zero.substr(0, 6 - code.length) + code;
  });
};

function make_string(str, quote){
  var dq = 0;
  var sq = 0;

  str = str.replace(/[\0\\\b\f\n\r\t\"\'\u2028\u2029]/g, function(s){
    switch (s)
    {
      case "\0": return "\\0";
      case "\\": return "\\\\";
      case "\b": return "\\b";
      case "\f": return "\\f";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\u2028": return "\\u2028";
      case "\u2029": return "\\u2029";
      case '"':
        if (quote == '"')
          return '\\"';
        dq++;
        break;
      case "'":
        if (quote == '\'')
          return '\\\'';
        sq++;
        break;
    }
    return s;
  });

  if (quote)
    return quote + str + quote;

  if (dq > sq)
    return "'" + (sq ? str.replace(/'/g, "\\'") : str) + "'";
  else
    return '"' + (dq ? str.replace(/"/g, '\\"') : str) + '"';
};


function repeat_string(str, i){
  if (i <= 0) return "";
  if (i == 1) return str;
  var d = repeat_string(str, i >> 1);
  d += d;
  if (i & 1) d += str;
  return d;
};


function HOP(obj, prop){
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

function defaults(args, defs){
  var ret = {};
  if (args === true)
    args = {};

  for (var i in defs)
    if (defs.hasOwnProperty(i))
      ret[i] = (args && args.hasOwnProperty(i)) ? args[i] : defs[i];

  return ret;
};

function empty(token) {
  if (!token) // null or token not a block
    return true;

  if (token[0] == 'block')
    return !token[1] || token[1].length == 0; // no statements
};

var $self = function(value){
  return value;
};

var SPLICE_NEEDS_BRACKETS = {
  "if": 1,
  "while": 1,
  "do": 1,
  "for": 1,
  "for-in": 1,
  "with": 1
};

var DOT_CALL_NO_PARENS = {
  "name": 1,
  "array": 1,
  "object": 1,
  "string": 1,
  "dot": 1,
  "sub": 1,
  "call": 1,
  "regexp": 1,
  "defun": 1
};

var ctorWalker = ast_walker();
function gen_code(ast, options){
  options = defaults(options,
  {
    indent_start: 0,
    indent_level: 4,
    indent_char: ' ',
    quote_keys: false,
    space_colon: false,
    beautify: false,
    ascii_only: false,
    inline_script: false,
    quote: 'auto'
  });

  var ascii_only = !!options.ascii_only;
  var beautify = !!options.beautify;
  var quote = /^(["']|auto)$/.test(options.quote) ? options.quote : 'auto';

  var newline = beautify ? '\n' : '';
  var space = beautify ? ' ' : '';
  var comma = ',' + space;

  var space_colon = !!(beautify && options.space_colon);

  var indent_char = options.indent_char;
  var indent_start = options.indent_start;
  var indent_level = options.indent_level;
  var indentation = 0;
  var indentStr = repeat_string(indent_char, indent_start);
  var indent = beautify
    ? function(str){
        return indentStr + str;
      }
    : $self;

  var makeString = quote != 'auto'
    ? function(str){
        return make_string(str, quote);
      }
    : make_string;

  var encode_string = options.inline_script
    ? function(str){
        return makeString(str).replace(/<\/script([>\/\t\n\f\r ])/gi, "<\\/script$1");
      }
    : makeString;

  var add_spaces = beautify
    ? function add_spaces(array){
        return array.join(" ");
      }
    : function add_spaces(array){
        var result;

        for (var i = 0, len = array.length, item; i < len; i++)
        {
          item = String(array[i]);

          if (!i)
            result = item;
          else
          {
            var fc = item.charAt(0);
            var lc = result.charAt(result.length - 1);

            if (!(SpecialSymbol.test(item) || SpecialSymbol.test(lc)) || (lc == fc && (lc == '+' || lc == '-')))
              result += ' ';

            result += item;
          }
        }

        return result || '';
      };

  function prependSpace(str){
    return (SpecialSymbol.test(str) ? space : ' ') + str;
  }

  var indentCache = {};
  function genIndent(offset){
    var len = indent_start + offset * indent_level;
    return len
      ? indentCache[len] || (indentCache[len] = repeat_string(indent_char, len))
      : '';
  }

  var indent_ = beautify
    ? function(delta, once){
        if (once)
          return genIndent(indentation + delta);

        if (delta)
          indentStr = genIndent(indentation += delta);

        return indentStr;
      } 
    : function(){
        return '';
      };


  function parenthesizeSeq(token){
    return token[0] == 'seq'
      ? '(' + walk(token) + ')'
      : walk(token);
  }

  function parenthesize(expr){
    var gen = walk(expr);

    for (var i = 1; i < arguments.length; ++i)
    {
      var el = arguments[i];
      if ((typeof el == 'function' && el(expr)) || expr[0] == el)
        return "(" + gen + ")";
    }

    return gen;
  };

  // search for shortest string in array
  function best_of(array){
    var len = array.length;
    var best = Infinity;
    var idx = -1;

    for (var i = 0; i < len; i++)
    {
      var itemLen = array[i].length;
      if (best > itemLen)
      {
        idx = i;
        best = itemLen;
      }
    }

    return array[idx];
  };

  function needs_parens(expr){
    if (expr[0] == "function" || expr[0] == "object")
    {
      // dot/call on a literal function requires the
      // function literal itself to be parenthesized
      // only if it's the first "thing" in a
      // statement.  This means that the parent is
      // "stat", but it could also be a "seq" and
      // we're the first in this "seq" and the
      // parent is "stat", and so on.  Messy stuff,
      // but it worths the trouble.
      var self = expr;
      var idx = stack.length - 1;
      var next;
      while (next = stack[--idx])
      {
        switch (next[0])
        {
          case "stat":
            return true;

          case "seq":
          case "call":
          case "dot":
          case "sub":
          case "conditional":
            if (next[1] !== self)
              return false;

            break;

          case "binary":
          case "assign":
          case "unary-postfix":
            if (next[2] !== self)
              return false;

            break;

          default:
            return false;
        }

        self = next;
      }
    }

    return !DOT_CALL_NO_PARENS.hasOwnProperty(expr[0]);
  };

  function make_num(num) {
    var str = num.toString(10);
    var a = [str.replace(/^0\./, ".").replace('e+', 'e')];
    var m;

    if (Math.floor(num) === num)
    {
      if (num >= 0)
      {
        a.push("0x" + num.toString(16).toLowerCase(), // probably pointless
        "0" + num.toString(8)); // same.
      }
      else
      {
        a.push("-0x" + (-num).toString(16).toLowerCase(), // probably pointless
        "-0" + (-num).toString(8)); // same.
      }

      if (m = /^(.*?)(0+)$/.exec(num))
        a.push(m[1] + "e" + m[2].length);
    }
    else
      if (m = /^0?\.(0+)(.*)$/.exec(num))
      {
        a.push(m[2] + "e-" + (m[1].length + m[2].length), str.substr(str.indexOf(".")));
      }

    return best_of(a);
  };

  // The squeezer replaces "block"-s that contain only a single
  // statement with the statement itself; technically, the AST
  // is correct, but this can create problems when we output an
  // IF having an ELSE clause where the THEN clause ends in an
  // IF *without* an ELSE block (then the outer ELSE would refer
  // to the inner IF).  This function checks for this case and
  // adds the block brackets if needed.
  function make_then(then_) {
    if (then_ == null)
      return ";";

    if (then_[0] == "do")
    {
      // https://github.com/mishoo/UglifyJS/issues/#issue/57
      // IE croaks with "syntax error" on code like this:
      //     if (foo) do ... while(cond); else ...
      // we need block brackets around do/while
      return make_block([then_]);
    }

    var b = then_;
    walk: while (true)
    {
      switch(b[0])
      {
        case 'if':
          if (!b[3]) // no else, we must add the block
            return make_block([then_]);

          b = b[3];
          break;

        case 'while':
        case 'do':
          b = b[2];
          break;

        case 'for':
        case 'for-in':
          b = b[4];
          break;

        default:
          break walk;
      }
    }

    return walk(then_);
  };

  function make_function(token, keyword, no_parens){
    var name = token[1];
    var args = token[2];
    var body = token[3];

    indent_(+1);
    var body = make_block_statements(body, true).map(indent).join(newline)
    indent_(-1);

    var out = (
      (keyword || 'function') + (name ? ' ' + name : '') + '(' + args.join(comma) + ')' + space + '{' + 
        (body ? newline + body + newline + indent_() : '') +
      '}'
    );


    return !no_parens && needs_parens(token)
      ? "(" + out + ")"
      : out;
  };

  function must_has_semicolon(node){
    while (node)
    {
      switch (node[0])
      {
        case "with":
        case "while":
          node = node[2];

          if (empty(node))
            return true;

          break;

        case "for":
        case "for-in":
          node = node[4];

          if (empty(node))
            return true;

          break;

        case "if":
          if (empty(node[2]) && !node[3]) // `if' with empty `then' and no `else'
            return true; 

          if (node[3]) 
          {
            if (empty(node[3])) // `else' present but empty
              return true; 

            node = node[3]; // dive into the `else' branch
          }
          else
            node = node[2]; // dive into the `then' branch

          break;

        case 'var':
        case 'const':
        case "directive":
          return true;

        default:
          return false;
      }
    }
  };


  var SEMICOLON_AFTER = {
    'var': true,
    'const': true,
    'directive': true,
    'stat': true,
    'return': true,
    'break': true,
    'continue': true
  };

  var semicolon = '';
  var semicolons = [];
  var yy = [];
  var ll = 0;
  function make_block_statements(statements, setSem, xx){
    var result = [];
    var oldSem = semicolon;
    //ll++;
    //console.log(repeat_string('>', ll), 'enter');

    /*if (setSem)
    {
      semicolons.push(semicolon);
      semicolon = beautify ? '[last];' : '';
    }*/

    if (setSem)
    {
      setSemicolon = false;
      yy.push(setSemicolon);
    }

    var semicolon = beautify ? ';' : '';

    var f = -1;
    var hasLast = false;
    for (var i = statements.length - 1, stat; stat = statements[i]; i--)
    {
      //console.log(JSON.stringify(stat));
      var line = walk(stat);

      if (line && !/\S/.test(line)) console.log(stat);

      if (!line) continue;
      f = i;

      if (SEMICOLON_AFTER.hasOwnProperty(stat[0]))
      {
        if (f == i)
          hasLast = true;
        result.unshift(line + semicolon);
      }
      else
        result.unshift(line);

      setSemicolon = true;
      semicolon = ';';
    }
    //console.log(repeat_string('>', ll), 'exit');
    //ll--;

    if (setSem)
    {
      //semicolon = oldSem;
      setSemicolon = yy.pop();
    }

    if (xx && result.length < 2 && !beautify && hasLast && setSemicolon)
    {
      setSemicolon = false;
      result[result.length - 1] += ';';
    }

    return result;
  };

  function force_block(token){
    if (token[0] != 'block')
      return make_block([token]);
    else
      return make_block(token[1]);
  }


  function make_block(statements){
    if (!statements)
      return '';
    if (statements.length == 0)
      return '';

    indent_(+1);
    var lines = make_block_statements(statements, false, true);
    indent_(-1);

    if (lines.length > 1)
    {
      //semicolon = '';
      return '{' + newline +
        lines.map(indent).join(newline) + newline + 
      indent_(-1, 1) + '}'
    }
    else
    {
      return lines[0];
    }
  };

  function make_1vardef(def){
    var name = def[0];
    var val = def[1];

    if (val)
      name += space + '=' + space + parenthesizeSeq(val);

    return name;
  };

  var handlers = {
    "toplevel": function(token){
      var statements = token[1];
      return make_block_statements(statements).join(newline + newline);
    },
    /*"block": function(token){
      global.count = (global.count || 0) + 1;
      var statements = token[1];
      return make_block(statements);
    },*/
    "var": function(token){
      var defs = token[1];
      return "var " + defs.map(make_1vardef).join(comma);
    },
    "const": function(token){
      var defs = token[1];
      return "const " + defs.map(make_1vardef).join(comma);
    },
    "try": function(token){
      var try_ = token[1];
      var catch_ = token[2];
      var finally_ = token[3];

      var out = ["try", make_block(try_)];

      if (catch_)
        out.push("catch" + space + "(" + catch_[0] + ")" + space +
          make_block(catch_[1])
        );

      if (finally_)
        out.push("finally",
          make_block(finally_)
        );

      return add_spaces(out);
    },
    "new": function(token){
      var ctor = token[1];
      var args = token[2];

      args = args.length > 0
        ? "(" + args.map(parenthesizeSeq).join(comma) + ")"
        : "";

      return 'new' + prependSpace(parenthesize(ctor, 'seq', 'binary', 'conditional', 'assign', 'call', function(expr){
        var has_call = {};
        try {
          ctorWalker.walk(expr, function(token){
            if (token[0] == 'call')
              throw has_call;
            if (token[0] == 'function' || token[0] == 'sub')
              return token;
          });
        } catch (ex) {
          if (ex === has_call) return true;
          throw ex;
        }
      })) + args;
    },
    "switch": function(token){
      var expr = token[1];
      var body = token[2];

      var n = body.length;
      var bodyCode = n == 0
        ? '{}'
        : '{' + newline +
            body.map(function(branch, i){
              var has_body = branch[1].length > 0;

              ;
              var code = branch[0]
                ? indent_(+.5, true) + 'case' + prependSpace(walk(branch[0])) + ":"
                : indent_(+.5, true) + 'default:';
                
              if (has_body)
              {
                indent_(+1);
                code += newline + make_block_statements(branch[1]).join(newline);
                indent_(-1);

                if (!beautify && i < n - 1)
                  code += "[switch];";
              }

              return code;
            }, this).join(newline) + newline +
          indent_() + '}';

      return (
        "switch" + space + "(" + walk(expr) + ")" + space +
        bodyCode
      )
    },
    "conditional": function(token){
      var cond = token[1];
      var then_ = token[2];
      var else_ = token[3];

      return (
        (ASSIGN_CONDITIONAL_SEQ.hasOwnProperty(cond[0]) ? '(' + walk(cond) + ')' : walk(cond)) +
        space + "?" + space +
        parenthesizeSeq(then_) +
        space + ":" + space +
        parenthesizeSeq(else_)
      );
    },
    "assign": function(token){
      var op = token[1];
      var lvalue = token[2];
      var rvalue = token[3];

      if (op && op !== true)
        op += "=";
      else
        op = "=";

      return walk(lvalue) + space + op + space + parenthesizeSeq(rvalue);
    },
    "dot": function(token){
      var expr = token[1];
      var out = walk(expr);

      if (expr[0] == "num")
      {
        if (!/[a-f.]/i.test(out))
          out += ".";
      }
      else
      {
        if (expr[0] != "function" && needs_parens(expr))
          out = "(" + out + ")";
      }

      return out + "." + token[2];
    },
    "call": function (token){
      var fn = token[1];
      var args = token[2];

      var result = walk(fn);

      if (result.charAt(0) != "(" && needs_parens(fn))
        result = "(" + result + ")";

      return result + "(" + args.map(parenthesizeSeq).join(comma) + ")";
    },
    "function": function(token){
      return make_function(token);
    },
    "defun": function(token){
      return make_function(token);
    },
    "if": function(token){
      var cond = token[1];
      var then_ = token[2];
      var else_ = token[3];

      var out = 'if' + space + '(' + walk(cond) + ')' + space;

      if (!else_)
        out += force_block(then_);
      else
        out += make_then(then_) +
          space + "else" + 
          prependSpace(force_block(else_));

      return out;
    },
    "for": function(token){
      var init = token[1];
      var cond = token[2];
      var step = token[3];
      var block = token[4];

      init = (init ? walk(init) : '') + ';' + space;//.replace(/;*\s*$/, ";" + space);
      cond = (cond ? walk(cond) : '') + ';' + space;//.replace(/;*\s*$/, ";" + space);
      step = (step ? walk(step) : '');//.replace(/;*\s*$/, "");

      var args = init + cond + step;
      if (args == '; ; ') args = ';;';

      return 'for' + space + '(' + args + ')' + space + force_block(block);
    },
    "for-in": function(token){
      var vvar = token[1];
      var key = token[2];
      var hash = token[3];
      var block = token[4];

      return (
        'for' + space + '(' + (vvar ? walk(vvar)/*.replace(/;+$/, '')*/ : walk(key)) + ' in' + prependSpace(walk(hash)) + ')' + space +
        make_block([block])
      );
    },
    "while": function(token){
      var condition = token[1];
      var block = token[2];
      return (
        'while' + space + '(' + walk(condition) + ')' + space +
        walk(block)
      );
    },
    "do": function(token){
      var condition = token[1];
      var block = token[2];
      return (
        'do' + space + walk(block) + space +
        'while' + space + '(' + walk(condition) + ')' +
      ';');
    },
    "return": function(token){
      var expr = token[1];

      return 'return' + (expr ? prependSpace(walk(expr)) : '');
    },
    "throw": function(token){
      var expr = token[1];

      return 'throw' + prependSpace(walk(expr));
    },
    "binary": function(token){
      var operator = token[1];
      var lvalue = token[2];
      var rvalue = token[3];

      var left = walk(lvalue);
      var right = walk(rvalue);

      // XXX: I'm pretty sure other cases will bite here.
      //      we need to be smarter.
      //      adding parens all the time is the safest bet.
      if (ASSIGN_CONDITIONAL_SEQ.hasOwnProperty(lvalue[0]) ||
          (lvalue[0] == "binary" && PRECEDENCE[operator] > PRECEDENCE[lvalue[1]]) ||
          (lvalue[0] == "function" && needs_parens(this))
         )
      {
        left = "(" + left + ")";
      }

      if (ASSIGN_CONDITIONAL_SEQ.hasOwnProperty(rvalue[0]) ||
          (rvalue[0] == "binary"
           && PRECEDENCE[operator] >= PRECEDENCE[rvalue[1]]
           && !(rvalue[1] == operator && (operator == '&&' || operator == '||' || operator == '*'))
         ))
      {
        right = "(" + right + ")";
      }
      else
      {
        if (!beautify && options.inline_script && (operator == "<" || operator == "<<") && /^\/script/i.test(right))
          right = " " + right;
      }

      return add_spaces([
        left, operator, right
      ]);
    },
    "unary-prefix": function(token){
      var operator = token[1];
      var expr = token[2];

      var val = walk(expr);

      if (!(expr[0] == "num" || (expr[0] == "unary-prefix" && !OPERATORS.hasOwnProperty(operator + expr[1])) || !needs_parens(expr)))
        val = "(" + val + ")";

      return operator + (operator == 'typeof' || operator == 'void' || operator == 'delete' ? " " : "") + val;
    },
    "unary-postfix": function(token){
      var operator = token[1];
      var expr = token[2];

      var val = walk(expr);

      if (!(expr[0] == "num" || (expr[0] == "unary-postfix" && !OPERATORS.hasOwnProperty(operator + expr[1])) || !needs_parens(expr)))
        val = "(" + val + ")";

      return val + operator;
    },
    "sub": function(token){
      var expr = token[1];
      var subscript = token[2];

      var hash = walk(expr);

      if (needs_parens(expr))
        hash = "(" + hash + ")";

      return hash + "[" + walk(subscript) + "]";
    },
    "object": function(token){
      var props = token[1];

      var out;
      
      if (props.length == 0)
        out = '{}';
      else
      {
        indent_(+1);
        out = 
          '{' + newline +
            props.map(function(p){
              if (p.length == 3)
              {
                // getter/setter.  The name is in p[0], the arg.list in p[1][2], the
                // body in p[1][3] and type ("get" / "set") in p[2].
                return indent_() + make_function(['function', p[0], p[1][2], p[1][3]], p[2], true);
              }

              var key = p[0];
              var val = parenthesizeSeq(p[1]);

              if (options.quote_keys)
                key = encode_string(key);
              else
              {
                if ((typeof key == 'number' || (!beautify && String(+key) == key)) && parseFloat(key) >= 0)
                  key = make_num(+key);
                else
                {
                  if (!is_identifier(key))
                    key = encode_string(key);
                }
              }

              return indent_() + key + (space_colon ? space : '') + ':' + space + val;
            }).join("," + newline) + newline +
          indent_(-1) + '}';
      }

      return needs_parens(token)
        ? "(" + out + ")"
        : out;
    },
    "regexp": function(token){
      var rx = token[1];
      var mods = token[2];

      return "/" + rx + "/" + mods;
    },
    "array": function(token){
      var elements = token[1];

      if (elements.length == 0)
        return "[]";

      return (
        "[" + space +
          elements.map(function(el, i){
            if (!beautify && el[0] == "atom" && el[1] == "undefined")
              return i == elements.length - 1 ? "," : "";
            else
              return parenthesizeSeq(el);
          }).join(comma) + space +
        "]"
      );
    },
    "stat": function(token){
      var stmt = token[1];
      return walk(stmt);
    },
    "seq": function(token){
      return token.slice(1).map(walk).join(comma);
    },
    "label": function(token){
      var name = token[1];
      var block = token[2];
      return name + space + ":" + space + walk(block);
    },
    "with": function(token){
      var expr = token[1];
      var block = token[2];

      return (
        "with" + space + "(" + walk(expr) + ")" + space +
        walk(block)
      );
    }/*,

    ///////////////////
    "splice": function(token){  // ???
      var statements = token[1];
      var parent = stack[stack.length - 1];
      if (SPLICE_NEEDS_BRACKETS.hasOwnProperty(parent))
      {
        // we need block brackets in this case
        return make_block(token[1]);
      }
      else
      {
        return make_block_statements(statements, true).join(newline + indent_());
      }
    }*/
  };

  global.stat = global.stat || {};
  function walk(token){

    /*global.count = (global.count || 0) + 1;*/

    /*if (!stat[token[0]])
      stat[token[0]] = 1;
    else
      stat[token[0]]++;*/

    var ret;
    if (!token) debugger;
    switch (token[0])
    {
      case 'name':
      case 'atom':
        return token[1];

      case 'string':
        return encode_string(token[1]);

      case 'num':
        return make_num(token[1]);

      case 'break':
      case 'continue':
        return token[0] + (token[1] ? ' ' + token[1] : '');

      case 'block':
        return make_block(token[1]);

      case 'debugger':
        return 'debugger';

      case "directive":
        return encode_string(token[1]) ;

      default:
        var fn = handlers[token[0]];

        if (!fn)
        {
          console.warn('AST translate: Unknown token type ')
          return '';
        }

        stack.push(token);
        ret = fn(token);
        stack.pop();
    }

    return ret;
  }


  var stack = [];
  var result = walk(ast);

  return ascii_only ? to_ascii(result) : result;
};

exports.gen_code = gen_code;
