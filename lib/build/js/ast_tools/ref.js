
function arrayRemove(ar, item){
  var index = ar.indexOf(item);
  if (index != -1)
  {
    ar.splice(index, 1);
    return true;
  }
}

function constRef(sym, value){
  if (value[0] == 'num' || value[0] == 'string')
  {
    sym.refName.push(value);
    return true;
  }
}

///////////////////

function Symbol(ref){
  this.ref = ref;
}
Symbol.prototype = {
  isEmpty: function(){
    return false;
  },
  remove: function(){},
  addRef: function(refName){
    this.refName = [refName];
    constRef(this, this.ref);
  }
}

var F = Function();
F.prototype = Symbol.prototype;

///////////////////////

function ObjectSymbol(token, ref){
  this.ref = ref;
}
ObjectSymbol.prototype = new F();
ObjectSymbol.prototype.addRef = function(refName){
  this.refName = [refName];
  constRef(this, this.ref[1]);
}

///////////////////////

function ObjectExportSymbol(token, ref){
  this.token = token;
  this.ref = ref;
}
ObjectExportSymbol.prototype = new F();
ObjectExportSymbol.prototype.isEmpty = function(){
  return !this.token[1].length;
}
ObjectExportSymbol.prototype.remove = function(){
  return !!arrayRemove(this.token[1], this.ref);
}
ObjectExportSymbol.prototype.addRef = function(refName){
  this.refName = [refName];
  if (constRef(this, this.constRef || this.ref[1]))
    this.remove();
  else
    this.ref[1] = ['assign', true, ['name', refName], this.ref[1]];
}

///////////////////////

function AssignExportSymbol(token, ref){
  this.token = token;
  this.ref = ref;
}
AssignExportSymbol.prototype = new F();
AssignExportSymbol.prototype.remove = function(){
  var ret = this.token.splice(1);
  this.token[0] = 'block';
  return !!ret.length;
}
AssignExportSymbol.prototype.addRef = function(refName){
  this.refName = [refName];
  if (constRef(this, this.ref))
    this.remove();
  else
    this.ref.splice(0, this.ref.length, 'assign', true, ['name', refName], this.ref.slice());
}

////////////////////////

module.exports = {
  Symbol: Symbol,
  ObjectSymbol: ObjectSymbol,
  ObjectExportSymbol: ObjectExportSymbol,
  AssignExportSymbol: AssignExportSymbol
};
