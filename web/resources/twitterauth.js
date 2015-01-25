var Passport = require('passport');
module.exports = function (app){
	app.get('/auth/twitter', Passport.authenticate('twitter'));
	app.get("/auth/twitter/callback", Passport.authenticate('twitter', { successRedirect: '/', failureRedirect: '/' }));
	app.get("/home", function(req, resp, next){
		resp.send(req.user);
	});
};