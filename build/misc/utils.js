
Array.prototype.add = function(value){
  return this.indexOf(value) == -1 && !!this.push(value);
}
Array.prototype.remove = function(value){
  var pos = this.indexOf(value);

  if (pos != -1)
    this.splice(pos, 1);

  return pos != -1;
}

String.prototype.repeat = function(count){
  var result = [];
  for (var i = 0; i < count; i++)
    result[i] = this;
  return result.join('');
}
