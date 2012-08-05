var ast_walker = require('./walker').ast_walker;
var parser = require('uglify-js').parser;
var is_identifier_char = parser.is_identifier_char;
var is_alphanumeric_char = parser.is_alphanumeric_char;
var PRECEDENCE = parser.PRECEDENCE;
var OPERATORS = parser.OPERATORS;

function is_identifier(name) {
        return /^[a-z_$][a-z0-9_$]*$/i.test(name)  //
                && name != "this"
                && !HOP(parser.KEYWORDS_ATOM, name)
                && !HOP(parser.RESERVED_WORDS, name)
                && !HOP(parser.KEYWORDS, name);
};

var ascii_zero = '0000';
function to_ascii(str) {
  return str.replace(/[\u0080-\uffff]/g, function(ch){
    var code = ch.charCodeAt(0).toString(16);
    //while (code.length < 4) code = "0" + code;
    return "\\u" + ascii_zero.substr(code.length) + code;
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


function repeat_string(str, i) {
        if (i <= 0) return "";
        if (i == 1) return str;
        var d = repeat_string(str, i >> 1);
        d += d;
        if (i & 1) d += str;
        return d;
};


function slice(a, start) {
        return Array.prototype.slice.call(a, start || 0);
};


function HOP(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
};

function defaults(args, defs) {
        var ret = {};
        if (args === true)
                args = {};
        for (var i in defs) if (HOP(defs, i)) {
                ret[i] = (args && HOP(args, i)) ? args[i] : defs[i];
        }
        return ret;
};

var MAP;

(function(){
        MAP = function(a, f, o) {
                var ret = [], top = [], i;
                function doit() {
                        var val = f.call(o, a[i], i);
                        if (val instanceof AtTop) {
                                val = val.v;
                                if (val instanceof Splice) {
                                        top.push.apply(top, val.v);
                                } else {
                                        top.push(val);
                                }
                        }
                        else if (val != skip) {
                                if (val instanceof Splice) {
                                        ret.push.apply(ret, val.v);
                                } else {
                                        ret.push(val);
                                }
                        }
                };
                if (a instanceof Array) for (i = 0; i < a.length; ++i) doit();
                else for (i in a) if (HOP(a, i)) doit();
                return top.concat(ret);
        };
        MAP.at_top = function(val) { return new AtTop(val) };
        MAP.splice = function(val) { return new Splice(val) };
        var skip = MAP.skip = {};
        function AtTop(val) { this.v = val };
        function Splice(val) { this.v = val };
})();


function empty(token) {
  if (!token) // null or token not a block
    return true;

  if (token[0] == 'block')
    return !token[1] || token[1].length == 0; // no statements
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

var $self = function(value){ return value };

var w = ast_walker();
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

  var make_name = ascii_only
    ? to_ascii
    : $self;

  var makeString = ascii_only
    ? function(str){
        return to_ascii(make_string(str));
      }
    : (quote != 'auto'
        ? function(str){
            return make_string(str, quote);
          }
        : make_string
      );

  var encode_string = options.inline_script
    ? function(str){
        return makeString(str).replace(/<\/script([>\/\t\n\f\r ])/gi, "<\\/script$1");
      }
    : makeString;

  var ccache = {};
  function is_identifier_char2(ch){
    if (ch in ccache)
      return ccache[ch];
    else
      return ccache[ch] = is_identifier_char(ch);
  };

  var add_spaces = beautify
    ? function(array){
        return array.join(" ");
      }
    : function(array){
        var result = "";
        for (var i = 0, next; i < array.length; ++i)
        {
          result += array[i];

          if (next = array[i + 1])
          {
            var next = String(next);
            var fc = next.charAt(0);
            var cur = String(array[i]);
            var lc = cur.charAt(cur.length - 1);
            if (
                (is_identifier_char2(lc) && (is_identifier_char2(fc) || fc == "\\"))
                ||
                ((lc == '+' || lc == '-') && (fc == '+' || fc == '-'))
               )
            {
              result += " ";
            }
          }
        }
        return result;
      };

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
      ? '(' + w.walkro(token) + ')'
      : w.walkro(token);
  }

  function parenthesize(expr) {
    var gen = w.walkro(expr);

    for (var i = 1; i < arguments.length; ++i)
    {
      var el = arguments[i];
      if ((typeof el == 'function' && el(expr)) || expr[0] == el)
        return "(" + gen + ")";
    }

    return gen;
  };

  // search for shortest string in array
  function best_of(array) {
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

  function needs_parens(expr) {
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
      var stack = w.stack;
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

    return !HOP(DOT_CALL_NO_PARENS, expr[0]);
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
  function make_then(th) {
    if (th == null)
      return ";";

    if (th[0] == "do")
    {
      // https://github.com/mishoo/UglifyJS/issues/#issue/57
      // IE croaks with "syntax error" on code like this:
      //     if (foo) do ... while(cond); else ...
      // we need block brackets around do/while
      return make_block([th]);
    }

    var b = th;
    walk: while (true)
    {
      switch(b[0])
      {
        case 'if':
          if (!b[3]) // no else, we must add the block
            return w.walkro(["block", [th]]);

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

    return w.walkro(th);
  };

  function make_function(token, keyword, no_parens) {
    var name = token[1];
    var args = token[2];
    var body = token[3];

    var out = add_spaces([
      (keyword || 'function') + (name ? ' ' + make_name(name) : '') + '(' + args.map(make_name).join(comma) + ')',
      make_block(body)
    ]);

    return !no_parens && needs_parens(token)
      ? "(" + out + ")"
      : out;
  };

  function must_has_semicolon(node) {
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

        case "directive":
          return true;

        default:
          return false;
      }
    }
  };


  function make_block_statements(statements, noindent){
    var result = [];

    for (var i = 0, last = statements.length - 1, stat; stat = statements[i]; i++)
    {
      var code = w.walkro(stat);
      if (code != ";")
      {
        if (!beautify && i == last && !must_has_semicolon(stat))
          code = code.replace(/;+\s*$/, "");

        result.push(code);
      }
    }

    return noindent
      ? result
      : result.map(indent);
  };


  function make_block(statements){
    if (!statements)
      return ";";

    if (statements.length == 0)
      return "{}";

    indent_(+1);
    return (
      "{" + newline +
        make_block_statements(statements).join(newline) + newline + 
      indent_(-1) + "}"
    );
  };

  function make_1vardef(def){
    var name = make_name(def[0]);
    var val = def[1];

    if (val)
      name = add_spaces([name, "=", parenthesizeSeq(val)]);

    return name;
  };

  var make = w.walkro;
  return w.walk(ast, {
    "string": function(token){
      var str = token[1];
      return encode_string(str);
    },
    "num": function(token){
      var num = token[1];
      return make_num(num);
    },
    "name": function(token){
      var name = token[1];
      return make_name(name);
    },
    "atom": function(token){
      var name = token[1];
      return make_name(name);
    },
    "debugger": function () {
      return "debugger;"
    },
    "toplevel": function(token){
      var statements = token[1];
      return make_block_statements(statements).join(newline + newline);
    },
    "block": function(token){
      var statements = token[1];
      return make_block(statements);
    },
    "var": function(token){
      var defs = token[1];
      return "var " + defs.map(make_1vardef).join(comma) + ";";
    },
    "const": function(token){
      var defs = token[1];
      return "const " + defs.map(make_1vardef).join(comma) + ";";
    },
    "try": function(token){
      var try_ = token[1];
      var catch_ = token[2];
      var finally_ = token[3];

      var out = ["try", make_block(try_)];

      if (catch_)
        out.push("catch", "(" + catch_[0] + ")",
          make_block(catch_[1])
        );

      if (finally_)
        out.push("finally",
          make_block(finally_)
        );

      return add_spaces(out);
    },
    "throw": function(token){
      var expr = token[1];

      return add_spaces(["throw", this.walk(expr)]) + ";";
    },
    "new": function(token){
      var ctor = token[1];
      var args = token[2];

      args = args.length > 0
        ? "(" + args.map(parenthesizeSeq).join(comma) + ")"
        : "";

      return add_spaces(["new", parenthesize(ctor, "seq", "binary", "conditional", "assign", function(expr){
        var has_call = {};
        try {
          ctorWalker.walk(expr, {
            "call": function(){
              throw has_call
            },
            "function": $self
          });
        } catch (ex) {
          if (ex === has_call) return true;
          throw ex;
        }
      }) + args]);
    },
    "switch": function(token){
      var expr = token[1];
      var body = token[2];

      var n = body.length;
      var bodyCode = n == 0
        ? "{}"
        : "{" + newline +
            body.map(function(branch, i){
              var has_body = branch[1].length > 0;

              ;
              var code = branch[0]
                ? indent_(+.5, true) + add_spaces(["case", this.walk(branch[0]) + ":"])
                : indent_(+.5, true) + "default:";
                
              if (has_body)
              {
                indent_(+1);
                code += newline + make_block_statements(branch[1]).join(newline);
                indent_(-1);

                if (!beautify && i < n - 1)
                  code += ";";
              }

              return code;
            }, this).join(newline) + newline +
          indent_() + "}";

      return add_spaces([
        "switch", "(" + this.walk(expr) + ")",
        bodyCode
      ]);
    },
    "break": function(token){
      var label = token[1];

      return 'break' + (label ? ' ' + make_name(label) : '') + ';';
    },
    "continue": function(token){
      var label = token[1];

      return 'continue' + (label ? ' ' + make_name(label) : '') + ';';
    },
    "conditional": function(token){
      var cond = token[1];
      var then_ = token[2];
      var else_ = token[3];

      return add_spaces([
        parenthesize(cond, "assign", "seq", "conditional"),
        "?",
        parenthesizeSeq(then_),
        ":",
        parenthesizeSeq(else_)
      ]);
    },
    "assign": function(token){
      var op = token[1];
      var lvalue = token[2];
      var rvalue = token[3];

      if (op && op !== true)
        op += "=";
      else
        op = "=";

      return add_spaces([
        this.walk(lvalue), op, parenthesizeSeq(rvalue)
      ]);
    },
    "dot": function(token){
      var expr = token[1];
      var out = this.walk(expr);

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

      out += "." + make_name(token[2]);
      return out;
    },
    "call": function (token){
      var fn = token[1];
      var args = token[2];

      var result = this.walk(fn);

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

      var out = [
        "if", "(" + this.walk(cond) + ")"
      ];

      if (!else_)
        out.push(
          this.walk(then_)
        );
      else
        out.push(
          make_then(then_),
          "else",
          this.walk(else_)
        );

      return add_spaces(out);
    },
    "for": function(token){
      var init = token[1];
      var cond = token[2];
      var step = token[3];
      var block = token[4];

      init = (init ? this.walk(init) : "").replace(/;*\s*$/, ";" + space);
      cond = (cond ? this.walk(cond) : "").replace(/;*\s*$/, ";" + space);
      step = (step ? this.walk(step) : "").replace(/;*\s*$/, "");

      var args = init + cond + step;
      if (args == "; ; ") args = ";;";

      return add_spaces([
        'for', '(' + args + ')',
        this.walk(block)
      ]);
    },
    "for-in": function(token){
      var vvar = token[1];
      var key = token[2];
      var hash = token[3];
      var block = token[4];

      return add_spaces([
        'for', '(' + (vvar ? this.walk(vvar).replace(/;+$/, '') : this.walk(key)), 'in', this.walk(hash) + ")",
        this.walk(block)
      ]);
    },
    "while": function(token){
      var condition = token[1];
      var block = token[2];
      return add_spaces([
        'while', '(' + this.walk(condition) + ')',
        this.walk(block)
      ]);
    },
    "do": function(token){
      var condition = token[1];
      var block = token[2];
      return add_spaces([
        'do', this.walk(block),
        'while', '(' + this.walk(condition) + ')'
      ]) + ";";
    },
    "return": function(token){
      var expr = token[1];
      var out = ["return"];

      if (expr)
        out.push(this.walk(expr));

      return add_spaces(out) + ";";
    },
    "binary": function(token){
      var operator = token[1];
      var lvalue = token[2];
      var rvalue = token[3];

      var left = this.walk(lvalue);
      var right = this.walk(rvalue);

      // XXX: I'm pretty sure other cases will bite here.
      //      we need to be smarter.
      //      adding parens all the time is the safest bet.
      if (["assign", "conditional", "seq"].indexOf(lvalue[0]) != -1 ||
          (lvalue[0] == "binary" && PRECEDENCE[operator] > PRECEDENCE[lvalue[1]]) ||
          (lvalue[0] == "function" && needs_parens(this))
         )
      {
        left = "(" + left + ")";
      }

      if (["assign", "conditional", "seq"].indexOf(rvalue[0]) != -1 ||
          (rvalue[0] == "binary"
           && PRECEDENCE[operator] >= PRECEDENCE[rvalue[1]]
           && !(rvalue[1] == operator && ['&&', '||', '*'].indexOf(operator) != -1)
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

      var val = this.walk(expr);

      if (!(expr[0] == "num" || (expr[0] == "unary-prefix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr)))
        val = "(" + val + ")";

      return operator + (['typeof', 'void', 'delete'].indexOf(operator) != -1 ? " " : "") + val;
    },
    "unary-postfix": function(token){
      var operator = token[1];
      var expr = token[2];

      var val = this.walk(expr);

      if (!(expr[0] == "num" || (expr[0] == "unary-postfix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr)))
        val = "(" + val + ")";

      return val + operator;
    },
    "sub": function(token){
      var expr = token[1];
      var subscript = token[2];

      var hash = this.walk(expr);

      if (needs_parens(expr))
        hash = "(" + hash + ")";

      return hash + "[" + this.walk(subscript) + "]";
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

              return indent_() + add_spaces(space_colon
                ? [key, ":", val]
                : [key + ":", val]
              );
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

      if (ascii_only)
        rx = to_ascii(rx);

      return "/" + rx + "/" + mods;
    },
    "array": function(token){
      var elements = token[1];

      if (elements.length == 0)
        return "[]";

      return add_spaces([
        "[",
          elements.map(function(el, i){
            if (!beautify && el[0] == "atom" && el[1] == "undefined")
              return i == elements.length - 1 ? "," : "";
            else
              return parenthesizeSeq(el);
          }).join(comma),
        "]"
      ]);
    },
    "stat": function(token){
      var stmt = token[1];
      return this.walk(stmt).replace(/;*\s*$/, ";");
    },
    "seq": function(token){
      return slice(token, 1).map(this.walkro).join(comma);
    },
    "label": function(token){
      var name = token[1];
      var block = token[2];
      return add_spaces([make_name(name), ":", this.walk(block)]);
    },
    "with": function(token){
      var expr = token[1];
      var block = token[2];

      return add_spaces([
        "with", "(" + this.walk(expr) + ")",
        this.walk(block)
      ]);
    },
    "directive": function(token){
      var dir = token[1];
      return makeString(dir) + ";";
    },

    ///////////////////
    "splice": function(token){  // ???
      var statements = token[1];
      var parent = this.top(1);
      if (HOP(SPLICE_NEEDS_BRACKETS, parent))
      {
        // we need block brackets in this case
        return make_block(token[1]);
      }
      else
      {
        return make_block_statements(statements, true).map(function(line, i){
          // the first line is already indented
          return i > 0 ? indent(line) : line;
        }).join(newline);
      }
    }
  });
};

exports.gen_code = gen_code;