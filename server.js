var port = process.env.PORT;
var config = {};
var runAsUser = null;
if(process.env.TWITTER_CONSUMER_KEY === undefined){
	process.env = require('./env.js');
}
process.argv.forEach(function(value, fileName, args){
	if(/as:/.test(value)) runAsUser = /as\:([a-zA-Z-]+)/.exec(value)[1];
	if(/port:/.test(value)) port = /port:(\d+)/.exec(value)[1];
});
if(!port) port = 10000;
var os=require('os');
var ifaces = os.networkInterfaces();
var addresses = [];
for(var key in ifaces){
	var iface = ifaces[key];
	var address = iface.reduce(function(previous, current, index, ary){
		return current.family === 'IPv4' && !current.internal ? current.address : null;
	});
	addresses.push(address);
}
var localhost = addresses.reduce(function(previous, current, index, ary){
	return current === null ? previous : current;
});
config.twitter = {
	key: process.env.TWITTER_CONSUMER_KEY
	, secret: process.env.TWITTER_CONSUMER_SECRET
	, callback: process.env.TWITTER_CALLBACK_URL
};
config.cookie = {
	secret: process.env.COOKIE_SECRET
	, key: process.env.COOKIE_KEY
};
config.hubotToken = process.env.HUBOT_AUTH_TOKEN;

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
var Datastore = require('nedb');
var passport = require('passport');
var TwitterStrategy = require('passport-twitter').Strategy;
var messages = new Datastore({filename: process.env.DATA_PATH + '/messages.db', autoload: true});
var posts = new Datastore({filename: process.env.DATA_PATH + '/posts.db', autoload: true});
var lastPost = new Datastore({filename: process.env.DATA_PATH + '/lastpost.db', autoload: true});
var members = new Datastore({filename: process.env.DATA_PATH + '/members.db', autoload: true});

[members, messages, posts, lastPost].forEach(function(db){
	db.persistence.setAutocompactionInterval(1*60*60);
});

var hubot = {"1": 
	{"token":config.hubotToken
	, "profile":{"provider":"local", "id":1, "username":"Hubot","displayName":"Hubot"
	, "_json":{"profile_image_url":"public/images/hubot.png"}}}
};
function logError(err){
	if(err) console.log(err);
}
(function crdeateHubotAccount(){
	members.findOne({"token":config.hubotToken}, function(err, member){
		if(!member){
			members.insert(hubot[1], logError);
		}
	});
})();

process.on('uncaughtException', function(err){
    console.trace('got an error:', err);
    process.exit(1);
});

app.response.represent = function(view, resource, model, next){
	resource.user = this.req.user;
	// all views have next, response, request, view, resource, and model in scope for referencing.
	Represent.execute({next: next, response: this, request: this.req, view: view, resource: resource, model: model});
};
var StaticServer = require('serve-static');
var CookieSession = require('cookie-session');
var Compression = require('compression');
app.use(Compression());
app.use("/public", StaticServer(Represent.themeRoot));
app.set("views", __dirname + "/themes/default/views");
app.set("view engine", function(view, options, fn){
	return fn(view, options);
});

var CookieParser = require('cookie-parser');
var BodyParser = require('body-parser');
var MethodOverride = require('method-override');
app.use(CookieParser());
app.use(BodyParser());
app.use(MethodOverride());
app.use(CookieSession({ keys: [config.cookie.key], secret: config.cookie.secret}));

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(function(member, done) {
	done(null, member.token);
});
passport.deserializeUser(function(token, done) {
	members.findOne({token: token}, function(err, member) {
		done(err, member);
	});
});

passport.use(new TwitterStrategy({
	consumerKey: config.twitter.key
	, consumerSecret: config.twitter.secret
	, callbackURL: config.twitter.callback
	, passReqToCallback: true
  }
  , function(request, token, tokenSecret, profile, done) {
	  var allowedTwitterUsers = ['ijoeyguerra', 'joseguerra', 'Hubot'];
	  members.findOne({"token":token}, function(err, member){
			if(err) return done(err);
			if(member) return done(null, member);
			console.log('member not found. going to save->', token);
			var member = {"token":token, "profile":profile};
			members.insert(member, function(err, key){
				console.log('saving->', err);
				if(err) return done(err);
				members.findOne({token: member.token}, function(err, member){
					console.log('finding member again->', err, member);
					done(null, member);
				});
			});
	  });
  }
));
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
// send errors back to client.
app.use(function(err, req, res, next){
  //console.trace('error:', JSON.stringify(err));
  var error = new ErrorMessage(err);
  res.send(error.message);
});

function ErrorMessage(error){
	if(typeof error === Object || error === 500){
		this.message = "Internal Server Error";
		this.code = 500;
	}else if(error === 401){
		this.message = "Unauthorized";
		this.code = 401;
	}else if(error === 404){
		this.message = "Not found";
		this.code = 404;
	}
}

function byDate(a, b){
	if(a.time === b.time) return 0;
	if(a.time < b.time) return -1;
	return 1;
}
function getPreviousMessages(callback){
	var today = new Date();
	today = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
	messages.find({"time": {$gte: today.getTime()}}, function(err, docs){
		if(err) throw err;
		callback(err, docs);
	});
}

var nicknames = {};
io.set('log level', 2);
io.set('authorization', function(data, callback){
	members.findOne({"token":data._query.token}, function(err, member){
		if(err) return callback("Unauthorized", false);
		if(!member) return callback("Unauthorized", false);
		nicknames[member.token] = {username: member.profile.username, name: member.profile.displayName, token: member.token, profile_image_url: member.profile._json.profile_image_url};
		callback(null, true);
	});
});

io.sockets.on('connection', function (socket) {
	socket.on('message', function (msg) {
		var message = {text: msg, time: (new Date()).getTime(), from: nicknames[socket.nickname]};
		socket.broadcast.emit('message', message);
	});
	socket.on('message', function(msg){
		console.log('saving message', msg);
		messages.insert({author: nicknames[this.nickname], message: msg, time: (new Date()).getTime()}, function(err, doc){
			if(err) console.log('error saving ', err);
		});
	});
	socket.on('send previous messages', function(msg, ack){
		getPreviousMessages(function(err, messages){
			if(err) throw err;
			return ack(messages);
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
		members.findOne({"token": nick}, function(err, member) {
			if(err) return fn(false);
			console.log('looking for member by nickname:', nick, err);
			if(!member) return fn(false);
			nicknames[nick] = {username: member.profile.username, name: member.profile.displayName, token: member.token, profile_image_url: member.profile._json.profile_image_url};
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
	console.log("server up and running on %s:%s", localhost, port);
});
