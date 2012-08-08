/* graph generator */
  
module.exports = function(flow){
  console.log('digraph graph {');
    var idx = 0;
    function name(file){
      if (!file.filename)
      {
        if (!file.xx)
          file.xx = '[no filename]' + idx++;
        return '"' + file.xx + '"';
      }
      return '"' + file.relpath + '"';
    }

    function color(file){
      switch (file.type){
        case 'html':   return ' [color="1 0 0"]';
        case 'script':   return ' [color="0.7 0.8 0.9"]';
        case 'style':    return ' [color="1 1 0.8"]';
        case 'template': return ' [color="0.7 1 0.7"]';
        case 'l10n':     return ' [color="1 0.9 0.5"]';
        case 'image':    return ' [color="0.6 0.9 1"]';
      }
      return '';
    }

    var ncount = 0;
    var rcount = 0;
    flow.files.queue.forEach(function(file){
      var c = color(file);
      if (c) console.log(name(file) + c);
        ncount++;
      file.linkTo.forEach(function(linkTo){
        rcount++;
        console.log(name(file) + '->' + name(linkTo));
      });
    });
  console.log('}');
    //console.log('N:' + ncount, 'R: ' +rcount);
    process.exit();
  }
