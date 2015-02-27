// <?xml version="1.0" encoding="utf-8"?>
// <checkstyle version="4.3">
//     <file name="{filename}">
//         <error line="{line}" column="{column}" severity="error" message="{message}" source="basisjs" />
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

        if (!loc)
          loc = ':1:1';
        if (!Array.isArray(loc))
          loc = [loc];

        return loc.map(function(loc){
          var line = 1;
          var column = 1;
          var m = loc.match(/:(\d+):(\d+)$/);

          if (m)
          {
            line = m[1];
            column = m[2];
          }

          return '\t\t<error line="' + line + '" column="' + column + '" severity="error" message="' + w.message.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" source="basisjs-lint"/>';
        }).join('\n');
      }).join('\n'),
      '\t</file>'
    );
  });

  output.push('</checkstyle>');

  console.log(output.join('\n'));
};
