var signer = require('jws');
var Commands = require('../profile/commands');
var Events = require('../profile/events');
var hooks = [];
var Member = require('../profile/entities/member');
var bus = require('../boundaries/inprocbus');
var nicknames = {};
var clients = {};
var io = null;
var Persistence = null;
bus.start();
bus.iHandle('SendNewChatMessage', {
	handle: function(command){
		var user = nicknames[command.body.socketId] || new Member(command.body.from);
		var m = {text: command.body.text, time: (new Date()).getTime(), from: user, socketId: command.body.socketId};
		Persistence.member.findOne({username: user.username}, function(err, doc){
			m.from.avatar = '/public/images/penguins.jpg';
			m.from.username = command.body.from.username;
			m.from.name = command.body.from.name;
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
	update: function(event){
		io.emit('message', event.body);
	}
});

module.exports = function(server){
	io = require('socket.io')(server.server);
	var cookieParserFunction = server.cookieParser();
	var cookieSessionFunction = server.cookieSession({ keys: [server.config.cookie.key, ':blah:'], secret: server.config.cookie.secret});
	Persistence = server.Persistence;
	function createClient(nick, room, socket){
		return {
			connect: function(callback){
				var m = {room: room, text: "Welcome to devchitchat.",
					from: {name: 'devchitchat', avatar: '/public/images/bot.png', username: 'devchitchat'},
					socketId: socket.id
				};
				callback(m);
			},
			disconnect: function(message){
				console.log('disconnected', message);
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
		var room = "#" + getRoomFromReferrer(socket);
		console.log('on connection');
		socket.on('message', function (msg) {
			var room = "#" + getRoomFromReferrer(socket);
			var message = {
				text: msg,
				time: (new Date()).getTime(),
				from: nicknames[socket.id],
				room: room,
				socketId: socket.id
			};
			clients[socket.id].say(message);
		});
		socket.on('send previous messages', function(msg, ack){
			return ack([]);
		});
		socket.on('nickname', function (nick, fn) {
			var room = "#" + getRoomFromReferrer(socket);
			socket.broadcast.emit('joined', nicknames[socket.id]);
			io.sockets.emit('nicknames', nicknames);
			return fn(true);
		});
		socket.on('left', function(user){
			clients[socket.id].disconnect("peace out!!");
		});
		socket.on('disconnect', function () {
			console.log('disconnecting', arguments);
			var room = "#" + getRoomFromReferrer(socket);
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
		console.log('connecting', socket.request._query.username);
	});
	return io;
};
