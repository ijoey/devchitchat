var Resource = require('../resource');
var passport = require('passport');
module.exports = function (app){
	var self = new Resource();
	app.get('/auth/twitter', passport.authenticate('twitter'));
	app.get("/auth/twitter/callback", function(req, resp, next){
		resp.send(req);
	});
	app.get("/home", function(req, resp, next){
		resp.send(req.user);
	});
	return self;
};