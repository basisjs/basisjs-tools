
module.exports = function(flowData){

  flowData.l10n = {
    cultureList: [],
    defList: [],
    packages: [],
    packDictionary: function(dict){
      if (!flowData.l10n.index)
        throw 'l10n index is not built yet';

      return packDictionary(linearDictionary(dict), flowData.l10n.index.map);
    }
  }

}

module.exports.handlerName = '[l10n] init';

