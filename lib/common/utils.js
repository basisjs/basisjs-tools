var fs = require('fs');

/**
* Trying get a commit hash for specified folder (supposed a git repo or bower library).
* @param {string} dir Location for lookup
* @param {number=} len Max length of hash
*/
function fetchCommit(dir, len){
  if (!len)
    len = 10;

  try {
    var gitPath = dir + '/.git/';
    var gitRef = fs.readFileSync(gitPath + 'HEAD', 'utf-8');
    if (gitRef)
    {
      var ref = gitRef.match(/(?:^|\n)ref:\s*([^\n]+)/);
      if (ref)
        return fs.readFileSync(gitPath + ref[1], 'utf-8').substr(0, len);
    }
  } catch(e) {}

  try {
    return require(dir + '/.bower.json')._resolution.commit.substr(0, len);
  } catch(e){}
}

/**
* Returns proper tools version. If dev version it adds to version commit hash.
* @param {boolean} tag Return version as tag, i.e. `x.x.x-dev-hash`. Otherwise returns `basisjs-tools@x.x.x (hash)`.
* @return {string} Current tools version.
*/
function getToolsId(tag){
  var toolsPkg = require('../../package.json');
  var toolsId = toolsPkg._id;
  var commit;

  if (!toolsId)
  {
    commit = fetchCommit(__dirname + '/../..');
    toolsId = (!tag ? toolsPkg.name + '@' : '') + toolsPkg.version;
  }
  else
  {
    if (tag)
      toolsId = toolsId.replace(/^.+\@/, '');

    if (toolsPkg._resolved)
    {
      var m = toolsPkg._resolved.match(/#(.{1,10})/);
      if (m)
        commit = m[1];
    }
  }

  if (commit)
    toolsId += tag
      ? '-dev-' + commit
      : ' (' + commit + ')';

  return toolsId;
}

module.exports = {
  fetchCommit: fetchCommit,
  getToolsId: getToolsId
};
