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

function to_ascii(str) {
  return str.replace(/[\u0080-\uffff]/g, function (ch) {
    var code = ch.charCodeAt(0).toString(16);
    while (code.length < 4) code = "0" + code;
    return "\\u" + code;
  });
};

function make_string(str, ascii_only) {
  var dq = 0,
    sq = 0;
  str = str.replace(/[\\\b\f\n\r\t\x22\x27\u2028\u2029\0]/g, function (s) {
    switch (s) {
      case "\\": return "\\\\";
      case "\b": return "\\b";
      case "\f": return "\\f";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\u2028": return "\\u2028";
      case "\u2029": return "\\u2029";
      case '"': ++dq; return '"';
      case "'": ++sq; return "'";
      case "\0": return "\\0";
    }
    return s;
  });
  if (ascii_only) str = to_ascii(str);
  if (dq > sq) return "'" + str.replace(/\x27/g, "\\'") + "'";
  else return '"' + str.replace(/\x22/g, '\\"') + '"';
};

function member(name, array) {
        for (var i = array.length; --i >= 0;)
                if (array[i] == name)
                        return true;
        return false;
};

function slice(a, start) {
        return Array.prototype.slice.call(a, start || 0);
};

function empty(token) {
  if (!token) // null or token not a block
    return true;

  if (token[0] == 'block')
    return !token[1] || token[1].length == 0; // no statements
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


function gen_code(ast, options) {
  options = defaults(options,
  {
    indent_start: 0,
    indent_level: 4,
    quote_keys: false,
    space_colon: false,
    beautify: false,
    ascii_only: false,
    inline_script: false
  });

  var ascii_only = !!options.ascii_only;
  var beautify = !!options.beautify;
  var indentation = 0;
  var newline = beautify ? "\n" : "";
  var space = beautify ? " " : "";

  var comma = "," + space;

  function encode_string(str) {
    var ret = make_string(str, ascii_only);
    if (options.inline_script) ret = ret.replace(/<\x2fscript([>\/\t\n\f\r ])/gi, "<\\/script$1");
    return ret;
  };

  function make_name(name) {
    name = name.toString();
    if (ascii_only) name = to_ascii(name);
    return name;
  };

  function indent(line) {
    if (line == null) line = "";
    if (beautify) line = repeat_string(" ", options.indent_start + indentation * options.indent_level) + line;
    return line;
  };

  function with_indent(cont, incr) {
    if (incr == null) incr = 1;
    indentation += incr;
    try {
      return cont.apply(null, slice(arguments, 1));
    } finally {
      indentation -= incr;
    }
  };

  function last_char(str) {
    str = str.toString();
    return str.charAt(str.length - 1);
  };

  function add_spaces(a) {
    if (beautify)
      return a.join(" ");

    var b = [];
    for (var i = 0; i < a.length; ++i)
    {
      var next = a[i + 1];
      b.push(a[i]);
      if (next)
      {
        var firstChar = String(next)[0];
        var lastChar = last_char(a[i]);
        if (
            (is_identifier_char(lastChar) && (is_identifier_char(firstChar) || firstChar == "\\"))
            ||
            (/[\+\-]$/.test(a[i].toString()) && /^[\+\-]/.test(next.toString()))
           )
        {
          b.push(" ");
        }
      }
    }
    return b.join("");
  };

  function add_commas(a){
    return a.join(comma);
  };

  function parenthesize(expr) {
    var gen = make(expr);
    for (var i = 1; i < arguments.length; ++i) {
      var el = arguments[i];
      if ((el instanceof Function && el(expr)) || expr[0] == el) return "(" + gen + ")";
    }
    return gen;
  };

  function best_of(a) {
    if (a.length == 1) {
      return a[0];
    }
    if (a.length == 2) {
      var b = a[1];
      a = a[0];
      return a.length <= b.length ? a : b;
    }
    return best_of([a[0], best_of(a.slice(1))]);
  };

  function needs_parens(expr) {
    if (expr[0] == "function" || expr[0] == "object") {
      // dot/call on a literal function requires the
      // function literal itself to be parenthesized
      // only if it's the first "thing" in a
      // statement.  This means that the parent is
      // "stat", but it could also be a "seq" and
      // we're the first in this "seq" and the
      // parent is "stat", and so on.  Messy stuff,
      // but it worths the trouble.
      var a = slice(w.stack),
        self = a.pop(),
        p = a.pop();
      while (p) {
        if (p[0] == "stat") return true;
        if (((p[0] == "seq" || p[0] == "call" || p[0] == "dot" || p[0] == "sub" || p[0] == "conditional") && p[1] === self) || ((p[0] == "binary" || p[0] == "assign" || p[0] == "unary-postfix") && p[2] === self)) {
          self = p;
          p = a.pop();
        } else {
          return false;
        }
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

    if (th[0] == "do") {
      // https://github.com/mishoo/UglifyJS/issues/#issue/57
      // IE croaks with "syntax error" on code like this:
      //     if (foo) do ... while(cond); else ...
      // we need block brackets around do/while
      return make_block([th]);
    }
    var b = th;
    while (true)
    {
      var type = b[0];
      if (type == "if") {
        if (!b[3])
        // no else, we must add the block
        return make(["block", [th]]);
        b = b[3];
      } else if (type == "while" || type == "do") b = b[2];
      else if (type == "for" || type == "for-in") b = b[4];
      else break;
    }
    return make(th);
  };

  function make_function(token, keyword, no_parens) {
    var name = token[1];
    var args = token[2];
    var body = token[3];
    var out = keyword || "function";

    if (name)
      out += " " + make_name(name);

    out += "(" + args.map(make_name).join(comma) + ")";
    out = add_spaces([out, make_block(body)]);

    return (!no_parens && needs_parens(token)) ? "(" + out + ")" : out;
  };

  function must_has_semicolon(node) {
    switch (node[0]){
      case "with":
      case "while":
        return empty(node[2]) || must_has_semicolon(node[2]);
      case "for":
      case "for-in":
        return empty(node[4]) || must_has_semicolon(node[4]);
      case "if":
        if (empty(node[2]) && !node[3]) // `if' with empty `then' and no `else'
          return true; 

        if (node[3]) 
        {
          if (empty(node[3])) // `else' present but empty
            return true; 

          return must_has_semicolon(node[3]); // dive into the `else' branch
        }
        return must_has_semicolon(node[2]); // dive into the `then' branch
      case "directive":
        return true;
    }
  };

  function make_block_statements(statements, noindent) {
    for (var a = [], last = statements.length - 1, i = 0; i <= last; ++i) {
      var stat = statements[i];
      var code = make(stat);
      if (code != ";") {
        if (!beautify && i == last && !must_has_semicolon(stat)) {
          code = code.replace(/;+\s*$/, "");
        }
        a.push(code);
      }
    }
    return noindent ? a : MAP(a, indent);
  };

  function make_switch_block(body) {
    var n = body.length;
    if (n == 0) return "{}";
    return "{" + newline + MAP(body, function (branch, i) {
      var has_body = branch[1].length > 0,
        code = with_indent(function () {
          return indent(branch[0] ? add_spaces(["case", make(branch[0]) + ":"]) : "default:");
        }, 0.5) + (has_body ? newline + with_indent(function () {
          return make_block_statements(branch[1]).join(newline);
        }) : "");
      if (!beautify && has_body && i < n - 1) code += ";";
      return code;
    }).join(newline) + newline + indent("}");
  };

  function make_block(statements) {
    if (!statements) return ";";
    if (statements.length == 0) return "{}";
    return "{" + newline + with_indent(function () {
      return make_block_statements(statements).join(newline);
    }) + newline + indent("}");
  };

  function make_1vardef(def) {
    var name = def[0],
      val = def[1];
    if (val != null) name = add_spaces([make_name(name), "=", parenthesize(val, "seq")]);
    return name;
  };

  var w = ast_walker();
  var make = w.walk;
  return w.walk(ast, {
    "string": function(token){
      var str = token[1];
      return encode_string(str)
    },
    "num": function(token){
      var num = token[1];
      return make_num(num)
    },
    "name": function(token){
      var name = token[1];
      return make_name(name)
    },
    "debugger": function () {
      return "debugger;"
    },
    "toplevel": function (token) {
      var statements = token[1];
      return make_block_statements(statements).join(newline + newline);
    },
    "splice": function (token) {
      var statements = token[1];
      var parent = w.top(1);
      if (HOP(SPLICE_NEEDS_BRACKETS, parent)) {
        // we need block brackets in this case
        return make_block(token[1]);
      } else {
        return MAP(make_block_statements(statements, true),

        function (line, i) {
          // the first line is already indented
          return i > 0 ? indent(line) : line;
        }).join(newline);
      }
    },
    "block": function(token){
      var statements = token[1];
      return make_block(statements);
    },
    "var": function (token) {
      var defs = token[1];
      return "var " + add_commas(MAP(defs, make_1vardef)) + ";";
    },
    "const": function (token) {
      var defs = token[1];
      return "const " + add_commas(MAP(defs, make_1vardef)) + ";";
    },
    "try": function (token) {
      var tr = token[1];
      var ca = token[2];
      var fi = token[3];

      var out = ["try", make_block(tr)];
      if (ca) out.push("catch", "(" + ca[0] + ")", make_block(ca[1]));
      if (fi) out.push("finally", make_block(fi));
      return add_spaces(out);
    },
    "throw": function (token) {
      var expr = token[1];
      return add_spaces(["throw", make(expr)]) + ";";
    },
    "new": function (token) {
      var ctor = token[1];
      var args = token[2];
      args = args.length > 0 ? "(" + add_commas(MAP(args, function (expr) {
        return parenthesize(expr, "seq");
      })) + ")" : "";

      return add_spaces(["new", parenthesize(ctor, "seq", "binary", "conditional", "assign", function (expr) {
        var w = ast_walker(),
          has_call = {};
        try {
          w.walk(expr, {
            "call": function () {
              throw has_call
            },
            "function": function (token) {
              return token;
            }
          });
        } catch (ex) {
          if (ex === has_call) return true;
          throw ex;
        }
      }) + args]);
    },
    "switch": function (token) {
      var expr = token[1];
      var body = token[2];
      return add_spaces(["switch", "(" + make(expr) + ")", make_switch_block(body)]);
    },
    "break": function (token) {
      var label = token[1];
      var out = "break";
      if (label != null) out += " " + make_name(label);
      return out + ";";
    },
    "continue": function (token) {
      var label = token[1];
      var out = "continue";
      if (label != null) out += " " + make_name(label);
      return out + ";";
    },
    "conditional": function (token) {
      var co = token[1];
      var th = token[2];
      var el = token[3];
      return add_spaces([parenthesize(co, "assign", "seq", "conditional"), "?",
      parenthesize(th, "seq"), ":",
      parenthesize(el, "seq")]);
    },
    "assign": function (token) {
      var op = token[1];
      var lvalue = token[2];
      var rvalue = token[3];
      if (op && op !== true) op += "=";
      else op = "=";
      return add_spaces([make(lvalue), op, parenthesize(rvalue, "seq")]);
    },
    "dot": function (token) {
      var expr = token[1];
      var out = make(expr);
      if (expr[0] == "num") {
        if (!/[a-f.]/i.test(out))
          out += ".";
      } else if (expr[0] != "function" && needs_parens(expr)) out = "(" + out + ")";
      out += "." + make_name(token[2]);
      return out;
    },
    "call": function (token) {
      var func = token[1];
      var args = token[2];
      var f = make(func);
      if (f.charAt(0) != "(" && needs_parens(func)) f = "(" + f + ")";
      return f + "(" + add_commas(MAP(args, function (expr) {
        return parenthesize(expr, "seq");
      })) + ")";
    },
    "function": function(token){
      var name = token[1];
      var args = token[2];
      var body = token[3];
      return make_function(token);
    },
    "defun": function(token){
      var name = token[1];
      var args = token[2];
      var body = token[3];
      return make_function(token);
    },
    "if": function (token) {
      var co = token[1];
      var th = token[2];
      var el = token[3];
      var out = ["if", "(" + make(co) + ")", el ? make_then(th) : make(th)];
      if (el) {
        out.push("else", make(el));
      }
      return add_spaces(out);
    },
    "for": function (token) {
      var init = token[1];
      var cond = token[2];
      var step = token[3];
      var block = token[4];

      var out = ["for"];
      init = (init != null ? make(init) : "").replace(/;*\s*$/, ";" + space);
      cond = (cond != null ? make(cond) : "").replace(/;*\s*$/, ";" + space);
      step = (step != null ? make(step) : "").replace(/;*\s*$/, "");
      var args = init + cond + step;
      if (args == "; ; ") args = ";;";
      out.push("(" + args + ")", make(block));
      return add_spaces(out);
    },
    "for-in": function (token) {
      var vvar = token[1];
      var key = token[2];
      var hash = token[3];
      var block = token[4];

      return add_spaces(["for", "(" + (vvar ? make(vvar).replace(/;+$/, "") : make(key)), "in",
      make(hash) + ")", make(block)]);
    },
    "while": function (token) {
      var condition = token[1];
      var block = token[2];
      return add_spaces(["while", "(" + make(condition) + ")", make(block)]);
    },
    "do": function (token) {
      var condition = token[1];
      var block = token[2];
      return add_spaces(["do", make(block), "while", "(" + make(condition) + ")"]) + ";";
    },
    "return": function (token) {
      var expr = token[1];
      var out = ["return"];
      if (expr != null) out.push(make(expr));
      return add_spaces(out) + ";";
    },
    "binary": function (token) {
      var operator = token[1];
      var lvalue = token[2];
      var rvalue = token[3];

      var left = make(lvalue),
        right = make(rvalue);
      // XXX: I'm pretty sure other cases will bite here.
      //      we need to be smarter.
      //      adding parens all the time is the safest bet.
      if (member(lvalue[0], ["assign", "conditional", "seq"]) || lvalue[0] == "binary" && PRECEDENCE[operator] > PRECEDENCE[lvalue[1]] || lvalue[0] == "function" && needs_parens(token)) {
        left = "(" + left + ")";
      }
      if (member(rvalue[0], ["assign", "conditional", "seq"]) || rvalue[0] == "binary" && PRECEDENCE[operator] >= PRECEDENCE[rvalue[1]] && !(rvalue[1] == operator && member(operator, ["&&", "||", "*"]))) {
        right = "(" + right + ")";
      } else if (!beautify && options.inline_script && (operator == "<" || operator == "<<") && rvalue[0] == "regexp" && /^script/i.test(rvalue[1])) {
        right = " " + right;
      }
      return add_spaces([left, operator, right]);
    },
    "unary-prefix": function (token) {
      var operator = token[1];
      var expr = token[2];

      var val = make(expr);
      if (!(expr[0] == "num" || (expr[0] == "unary-prefix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr))) val = "(" + val + ")";
      return operator + (is_alphanumeric_char(operator.charAt(0)) ? " " : "") + val;
    },
    "unary-postfix": function (token) {
      var operator = token[1];
      var expr = token[2];

      var val = make(expr);
      if (!(expr[0] == "num" || (expr[0] == "unary-postfix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr))) val = "(" + val + ")";
      return val + operator;
    },
    "sub": function (token) {
      var expr = token[1];
      var subscript = token[2];

      var hash = make(expr);
      if (needs_parens(expr)) hash = "(" + hash + ")";
      return hash + "[" + make(subscript) + "]";
    },
    "object": function (token) {
      var props = token[1];

      var obj_needs_parens = needs_parens(token);
      if (props.length == 0) return obj_needs_parens ? "({})" : "{}";
      var out = "{" + newline + with_indent(function () {
        return MAP(props, function (p) {
          if (p.length == 3) {
            // getter/setter.  The name is in p[0], the arg.list in p[1][2], the
            // body in p[1][3] and type ("get" / "set") in p[2].
            return indent(make_function(['function', p[0], p[1][2], p[1][3]], p[2], true));
          }
          var key = p[0],
            val = parenthesize(p[1], "seq");
          if (options.quote_keys) {
            key = encode_string(key);
          } else if ((typeof key == "number" || !beautify && +key + "" == key) && parseFloat(key) >= 0) {
            key = make_num(+key);
          } else if (!is_identifier(key)) {
            key = encode_string(key);
          }
          return indent(add_spaces(beautify && options.space_colon ? [key, ":", val] : [key + ":", val]));
        }).join("," + newline);
      }) + newline + indent("}");
      return obj_needs_parens ? "(" + out + ")" : out;
    },
    "regexp": function (token) {
      var rx = token[1];
      var mods = token[2];
      if (ascii_only) rx = to_ascii(rx);
      return "/" + rx + "/" + mods;
    },
    "array": function (token) {
      var elements = token[1];
      if (elements.length == 0) return "[]";
      return add_spaces(["[", add_commas(MAP(elements, function (el, i) {
        if (!beautify && el[0] == "atom" && el[1] == "undefined") return i === elements.length - 1 ? "," : "";
        return parenthesize(el, "seq");
      })), "]"]);
    },
    "stat": function (token) {
      var stmt = token[1];
      return make(stmt).replace(/;*\s*$/, ";");
    },
    "seq": function (token) {
      return add_commas(MAP(slice(token, 1), make));
    },
    "label": function (token) {
      var name = token[1];
      var block = token[2];
      return add_spaces([make_name(name), ":", make(block)]);
    },
    "with": function (token) {
      var expr = token[1];
      var block = token[2];
      return add_spaces(["with", "(" + make(expr) + ")", make(block)]);
    },
    "atom": function (token) {
      var name = token[1];
      return make_name(name);
    },
    "directive": function (token) {
      var dir = token[1];
      return make_string(dir) + ";";
    }
  });
};

exports.gen_code = gen_code;