var secret = null;
var assert = require('assert');
var signer = require('jws');
var alg = 'HS256';
var Authenticator = {
  execute: function execute(token){
    if(token === null){
      return false;
    }

    if(token.trim().length === 0){
      return false;
    }

    var decoded = signer.decode(token);
    if(!decoded){
      return false;
    }
    var resignedToken = this.sign(decoded.payload);
    return resignedToken === token;
  },
  sign: function sign(token, algorithm){
    if(!algorithm){
      algorithm = alg;
    }
    return signer.sign({
      header: {alg: algorithm},
      payload: token,
      secret: secret
    });
  }
};


module.exports = function(s){
  assert(s, "Secret is required in order for this to work.");
  secret = s;
  return Authenticator;
};
