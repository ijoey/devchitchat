var Resource = require('../resource');
var passport = require('passport');
var nStore = require('../inmemoryrepo');//require('nstore');
//nStore = nStore.extend(require('nstore/query')());
module.exports = function login(app){
	var self = new Resource();
	self.title = "Dev Chit Chat.";
	self.js.push("index");
	self.css.push("index");
	app.get("/login", function(req, resp, next){
		resp.represent('login/index', self, {}, next);
	});
	app.post('/login', passport.authenticate('ldapauth', {session: false}), function(req, resp, next){
  	  resp.send({status: 'ok'});
	});
	return self;
};