var fs = require('fs');
var path = require('fs');

module.exports = function(basisDir, len){
  if (!len)
    len = 7;

  try {
    var gitPath = basisDir + '/.git/';
    var gitRef = fs.readFileSync(gitPath + 'HEAD', 'utf-8');
    if (gitRef)
    {
      var ref = gitRef.match(/(?:^|\n)ref:\s*([^\n]+)/);
      if (ref)
        return fs.readFileSync(gitPath + ref[1], 'utf-8').substr(0, len);
    }
  } catch(e) {}

  try {
    return require(basisDir + '/.bower.json')._resolution.commit.substr(0, len);
  } catch(e){}
};
