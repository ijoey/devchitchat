var Resource = require('../resource');
var passport = require('passport');
module.exports = function (app){
	var self = new Resource();
	app.get('/auth/google', passport.authenticate('google'));
	app.get("/auth/google/return", passport.authenticate('google', { successRedirect: '/', failureRedirect: '/' }));
	app.get("/home", function(req, resp, next){
		resp.send(req.user);
	});
	return self;
};