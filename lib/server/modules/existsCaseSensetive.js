var fs = require('fs');
var path = require('path');
var fsIsCaseSensetive =
  fs.existsSync(process.execPath.toLowerCase()) &&
  fs.existsSync(process.execPath.toUpperCase());


function checkFilenameCaseSensetive(filename, onerror, onsuccess){
  var parts = path.relative(process.cwd(), filename).split(path.sep).filter(Boolean);
  var checkPath = '.';
  var part;

  while (part = parts.shift())
  {
    if (part != '..' && fs.readdirSync(checkPath).indexOf(part) == -1)
      return onerror('Wrong case for `' + part + '` at `' + checkPath.replace(/^\./, '') + '`');

    checkPath += '/' + part;
  }

  onsuccess();
}

module.exports = function checkFileExists(filename, onerror, onsuccess){
  if (!fs.existsSync(filename)) {
    onerror('File not found');
    return;
  }

  if (fsIsCaseSensetive)
    checkFilenameCaseSensetive(filename, onerror, onsuccess);
  else
    onsuccess();
};
