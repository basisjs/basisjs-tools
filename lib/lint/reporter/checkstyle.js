// <?xml version="1.0" encoding="utf-8"?>
// <checkstyle version="4.3">
//     <file name="/var/folders/3c/wqpsb5kx2bv9n8s9m4f139kr0000gq/T/SublimeLinter3/demo.js">
//         <error line="37" column="41" severity="error" message="Illegal trailing whitespace" source="jscs" />
//     </file>
// </checkstyle>
module.exports = function(flow){
  var output = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<checkstyle version="4.3">'
  ];

  var warnByFilename = require('./process-warns.js')(flow);

  Object.keys(warnByFilename).sort().forEach(function(fn){
    output.push(
      '\t<file name="' + fn + '">',
      warnByFilename[fn].map(function(w){
        var loc = w.loc;
        var line = 1;
        var column = 1;

        if (loc && (loc = w.loc.match(/:(\d+):(\d+)$/)))
        {
          line = loc[1];
          column = loc[2];
        }

        return '\t\t<error line="' + line + '" column="' + column + '" severity="error" message="' + String(w).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" source="basisjs-lint"/>';
      }).join('\n'),
      '\t</file>'
    );
  });

  output.push('</checkstyle>');

  console.log(output.join('\n'));
};
