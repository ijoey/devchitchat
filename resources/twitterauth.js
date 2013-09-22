var Resource = require('../resource');
var passport = require('passport');
module.exports = function (app){
	var self = new Resource();
	app.get('/auth/twitter', passport.authenticate('twitter'));
	app.get("/auth/twitter/callback", passport.authenticate('twitter', { successRedirect: '/', failureRedirect: '/' }));
	app.get("/home", function(req, resp, next){
		resp.send(req.user);
	});
	return self;
};