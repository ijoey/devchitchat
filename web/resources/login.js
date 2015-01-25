var Passport = require('passport');
module.exports = function login(app){
	app.get("/login", function(req, resp, next){
		resp.represent({view: 'login/index', resource: new app.Resource({css: ['index'],
			js: ['index']}), model: {}});
	});
	app.post('/login', Passport.authenticate('ldapauth', {session: false}), function(req, resp, next){
  	  resp.send({status: 'ok'});
	});
};