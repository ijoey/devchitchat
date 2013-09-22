var port = process.env.PORT;
var config = {};
config.twitter = {
	key: process.env.TWITTER_CONSUMER_KEY
	, secret: process.env.TWITTER_CONSUMER_SECRET
	, callback: process.env.TWITTER_CALLBACK_URL
};
config.cookie = {
	secret: process.env.COOKIE_SECRET
	, key: process.env.COOKIE_KEY
};

var runAsUser = null;
var express = require('express');
var http = require('http');
var app = express();
var fs = require('fs');
var cachedResources = [];
var resourcesFolder = __dirname + "/resources";
var Represent = require("./represent");
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var nicknames = {};
var nStore = require('nstore');
nStore = nStore.extend(require('nstore/query')());
var passport = require('passport');
var TwitterStrategy = require('passport-twitter').Strategy;
var members = nStore.new('data/members.db', function(){
	console.log('nStore members loaded');
});
var messages = nStore.new('data/messages.db', function(){
	console.log('nStore messages loaded');
});

// run as:
// node app.js port:3001 as:joeyguerra
// as is the user name to run the process as in UNIX. Doesn't really work in Windows.

process.argv.forEach(function(value, fileName, args){
	if(/as:/.test(value)) runAsUser = /as\:([a-zA-Z-]+)/.exec(value)[1];
	if(/port:/.test(value)) port = /port:(\d+)/.exec(value)[1];
});
if(!port) port = 3000;
app.response.represent = function(view, resource, model, next){
	resource.user = this.req.user;
	// all views have next, response, request, view, resource, and model in scope for referencing.
	Represent.execute({next: next, response: this, request: this.req, view: view, resource: resource, model: model});
};
app.configure(function(){
	//app.use(express.errorHandler({ dumpExceptions: true, showStack: true }))
	app.use(express.compress());
	app.use("/public", express.static(Represent.themeRoot));
	app.set("views", __dirname + "/themes/default/views");
	app.set("view engine", function(view, options, fn){
		return fn(view, options);
	});
	app.use(express.methodOverride());
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.cookieSession({ key: config.cookie.key, secret: config.cookie.secret}));
	app.use(passport.initialize());
	app.use(passport.session());
	passport.serializeUser(function(member, done) {
		// nStore sets it's id on an object as a property on that object. So
		// doing a for in to get the key, in order to get the rest of the object.
		console.log('serializing -> ', member);
		// TODO: Make sure this is secured/signed/whatever so the hacking vectors are reduced.
		return done(null, member.token);
	});
	passport.deserializeUser(function(token, done) {
		console.log('deserializeUser -> ', token);
		members.find({token: token}, function(err, member) {
			for(var key in member) return done(err, member[key]);
		});
		return done("Didn't find you", null);
	});
	passport.use(new TwitterStrategy({
		consumerKey: config.twitter.key
		, consumerSecret: config.twitter.secret
		, callbackURL: config.twitter.callback
		, passReqToCallback: true
	  }
	  , function(request, token, tokenSecret, profile, done) {
		  var allowedTwitterUsers = ['ijoeyguerra', 'joseguerra'];
		  if(allowedTwitterUsers.indexOf(profile.username) === -1) return done(null, null);
		  members.find({"token":token}, function(err, results){
			  if(err) return done(err);
			  var foundMemberAndFinish = Object.keys(results).length > 0;
			  if(foundMemberAndFinish){
				  var member = (function(){ for(var key in results){return results[key];}})();
				  return done(null, member);
			  }
			  var member = {"token":token, "profile":profile};
				members.save(null, member, function(err, key){
					if(err) return done(err);
					members.find({token: member.token}, function(err, member){
						for(var key in member) return done(null, member[key]);
					});
				});
		  });
	  }
	));
	app.use(function(req, res, next){
		next();
	});
	app.get('/logout', function(req, res){
		req.logout();
		res.redirect('/');
	});
	// load resource files.
	fs.readdirSync(resourcesFolder).forEach(function(file) {
		var key = file.replace('.js', '');
		var resource = require(resourcesFolder + "/" + file)(app);
		cachedResources.push(resource);
	});
});
// send errors back to client.
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.send(500, 'Something broke!');
});

var nicknames = {};
io.configure(function(){
	io.set('log level', 2);
	io.set('authorization', function(handshakeData, callback){
		var cookieParser = express.cookieParser('needstobeconfiguredsomewhereelse....');
		var req = {headers: handshakeData.headers, cookies: handshakeData.headers.cookies, signedCookies: {}, secret: ''};
		var cookie = cookieParser(req, {}, function(req, res, err){});
		if(!req.signedCookies.chatter && handshakeData.query.token){
			req.signedCookies.chatter = {passport: {user: handshakeData.query.token}};
		} 
		members.find({"token":req.signedCookies.chatter.passport.user}, function(err, member){
			if(err) return callback("Unauthorized", false);
			member = (function(){for(var key in member) return member[key];})();
			if(!member) return callback("Unauthorized", false);
			nicknames[member.profile.username] = {username: member.profile.username, profile_image_url: member.profile._json.profile_image_url};
			callback(null, true);			
		});
	});
});

io.sockets.on('connection', function (socket) {
	socket.on('message', function (msg) {
		var message = {text: msg, time: (new Date()).getTime(), from: nicknames[socket.nickname]};
		/*var today = new Date();
		var thisMorning = (new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)).getTime();
		*/
		socket.broadcast.emit('message', message);
	});
	socket.on('message', function(msg){
		messages.save(null, {author: nicknames[this.nickname], message: msg, time: (new Date()).getTime()}, function(err, doc){
			if(err) console.log('error saving ', err);
		});
	});
	socket.on('nickname', function (nick, fn) {
		socket.nickname = nick;
		if (nicknames[nick]) {
			socket.broadcast.emit('joined', nicknames[nick]);
			io.sockets.emit('nicknames', nicknames);
			return fn(true);
		}
		console.log('couldnt find ', nick);
		members.find({"profile.username": nick}, function(err, member) {
			if(err){
				return fn(false);
			}
			member = (function(){for(var key in member) return member[key];})();
			console.log('looking for member by nickname:', nick, err);
			if(!member) return fn(false);
			nicknames[nick] = {username: member.profile.username, profile_image_url: member.profile._json.profile_image_url};
			socket.broadcast.emit('joined', nicknames[nick]);
			io.sockets.emit('nicknames', nicknames);
			return fn(true);
		});
		
	});
	socket.on('left', function(nick){
		console.log(nick, ' has left');
	});
	socket.on('disconnect', function () {
		console.log('disconnect->', socket.nickname);
		if (!socket.nickname) return;
		delete nicknames[socket.nickname];
		socket.broadcast.emit('left', socket.nickname);
		socket.broadcast.emit('nicknames', nicknames);
	});
	socket.emit('connected', nicknames);
});

server.listen(port, function(){
	if(runAsUser !== null){
		process.setgid(runAsUser);
		process.setuid(runAsUser);
	}
});
