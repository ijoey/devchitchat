var signer = require('jws');
var Commands = require('../app/commands');
var Events = require('../app/events');
var hooks = [];
var Member = require('../app/entities/member');
var Message = require('../app/entities/message');
var bus = require('../boundaries/inprocbus');
var nicknames = {};
var clients = {};
var io = null;
var Persistence = null;
var debug = require('debug')('chat');
var messageOfTheDay = "What are the measurable characteristics that define code quality?";
bus.start();
bus.iHandle('SendNewChatMessage', {
	handle: function(command){
		var m = command.body;
		m.from = nicknames[command.body.socketId] || new Member(command.body.from);
		Persistence.member.findOne({username: m.from.username}, function(err, doc){
			m.from.avatar = '/public/images/penguins.jpg';
			m.from.username = m.from.username;
			m.from.name = m.from.name;
			if(doc){
				m.from.avatar = doc.avatar;
				m.from.username = doc.username;
				m.from.name = doc.name;
			}
			hooks.forEach(function(hook){
				hook.execute(m);
			});
			bus.publish(new Events.NewChatMessageWasSent(m));
		});
    }
});
bus.iSubscribeTo('NewChatMessageWasSent', null, {
	update: function update(event){
		Persistence.message.save(event.body, function(err, doc){
			if(err){
				console.log('error occurred persisting message', err, doc);
			}
		});
	}
});
bus.iSubscribeTo('NewChatMessageWasSent', null, {
	update: function update(event){
		io.emit('message', event.body);
	}
});

module.exports = function(web){
	io = require('socket.io')(web.server);
	var cookieParserFunction = web.cookieParser();
	var cookieSessionFunction = web.cookieSession({ keys: [web.config.cookie.key, ':blah:'], secret: web.config.cookie.secret});
	Persistence = web.Persistence;
	function createClient(nick, room, socket){
		return {
			connect: function(callback){
				var m = {room: room, text: messageOfTheDay,
					from: {name: 'devchitchat', avatar: '/public/images/bot.png', username: 'devchitchat'},
					socketId: socket.id
				};
				callback(m);
			},
			disconnect: function(message){
				debug('disconnected', message);
			},
			join: function(room, callback){
				callback(nick, nick + " joined the room");
			},
			say: function(message){
				bus.send(new Commands.SendNewChatMessage(message));
			}
		};
	}
	
	function getRoomFromReferrer(socket){
		if(!socket.handshake.headers.referer){
			return null;
		}
		return socket.handshake.headers.referer.split('/').pop();
	}
	
	io.use(function(socket, next){
		cookieParserFunction(socket.request, socket.request.res, function(){
			cookieSessionFunction(socket.request, socket.request.res, function(){
				var decodedSignature = signer.decode(socket.request.session.passport.user);
				if(!decodedSignature){
					return next(new Error("Unauthorized"));
				}
				Persistence.member.findOne({username: socket.request._query.username}, function(err, doc){
					if(doc){
						nicknames[socket.id] = new Member(doc);						
						next();
					}else{
						next(401);	
					}
				});
			});
		});
	});
	io.on('connection', function (socket) {
		var room = getRoomFromReferrer(socket);
		debug('on connection');
		socket.on('message', function (msg) {
			var room = getRoomFromReferrer(socket);
			var message = {
				text: msg,
				time: (new Date()).getTime(),
				from: nicknames[socket.id],
				room: room,
				to: null,
				socketId: socket.id
			};
			clients[socket.id].say(message);
		});
		socket.on('send previous messages', function(msg, ack){
			Persistence.message.findPrevious24Hours(room, function(err, doc){
				if(err){
					console.log("error sending today messages", err);
				}
				return ack(doc);
			});
		});
		socket.on('nickname', function (nick, fn) {
			var room = getRoomFromReferrer(socket);
			socket.broadcast.emit('joined', nicknames[socket.id]);
			io.sockets.emit('nicknames', nicknames);
			return fn(true);
		});
		socket.on('left', function(user){
			clients[socket.id].disconnect("peace out!!");
		});
		socket.on('disconnect', function () {
			debug('disconnecting', arguments);
			var room = getRoomFromReferrer(socket);
			clients[socket.id].disconnect("peace out!!");
			delete clients[socket.id];
			delete nicknames[socket.id];
			io.sockets.emit('left', socket.id);
			io.sockets.emit('nicknames', nicknames);
		});
		clients[socket.id] = createClient(socket.request._query.username, room, socket);
        clients[socket.id].connect(function(message){
			socket.emit('message', message);
            clients[socket.id].join(room, function(who, message){});
        });
		socket.emit('connected', nicknames);
		debug('connecting', socket.request._query.username);
	});
	return io;
};
