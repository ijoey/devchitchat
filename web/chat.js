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
var Domain = require('domain');
bus.start();
bus.iHandle('SendNewChatMessage', {
	handle: function(command){
		Persistence.member.findOne({username: command.body.from.username}, function(err, doc){
			if(err){
				console.log(err);
			}
			if(doc){
				command.body.from.avatar = doc.avatar;
				command.body.from.username = doc.username;
				command.body.from.name = doc.name;
			}
			hooks.forEach(function(hook){
				hook.execute(m);
			});
			io.to(command.body.room).emit('message', command.body);
			bus.publish(new Events.NewChatMessageWasSent(command.body));
		});
    }
});
bus.iHandle('SendNicknames', {
	handle: function handle(command){
		io.sockets.to(command.body.room).emit('nicknames', command.body.nicknames);
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
		if(/^pipbot/.test(event.body.text)){
			io.to(event.body.room).emit('message', new Message({text: 'ready', room: event.body.room, from: Member.pipbot, time: new Date()}));
		}
	}
});
bus.iSubscribeTo('UserHasLeft', null, {
	update: function update(event){
		delete nicknames[event.body.id];
		io.sockets.to(event.body.room).emit('left', event.body.id);
	}
});
function getRoomFromReferrer(socket){
	if(!socket.handshake.headers.referer){
		return null;
	}
	return socket.handshake.headers.referer.split('/').pop();
}

module.exports = function init(web){
	io = require('socket.io')(web.server);
	var cookieParserFunction = web.cookieParser();
	var cookieSessionFunction = web.cookieSession({ keys: [web.config.cookie.key, ':blah:'], secret: web.config.cookie.secret});
	Persistence = web.Persistence;
	
	io.use(function(socket, next){
	    var d = Domain.create();
	    d.on('error', function(err){
	        console.log('error', err.stack);
	        try{
	            var killtimer = setTimeout(function(){
	                process.exit(1);
	            }, 30000);
	            killtimer.unref();
	            socket.request.res.statusCode = 500;
	            socket.request.res.end('oops, application crashed.\n');
	        }catch(err2){
	            console.log('Error sending the 500 response after an error already occurred.', err2.stack);
	        }
	    });
	    d.add(socket.request);
	    d.add(socket.request.res);
		d.run(function(){
			next();
		});
	});
	
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
	function Client(socket, room, nicknames, delegate){
		this.socket = socket;
		this.room = room;
		this.nicknames = nicknames;
		this.delegate = delegate;
		this.socket.on('message', this.onMessage.bind(this));
		this.socket.on('send previous messages', this.onSendPreviousMessages.bind(this));
		this.socket.on('nickname', this.onNickname.bind(this));
		this.socket.on('left', this.onLeft.bind(this));
		socket.on('disconnect', this.onDisconnect.bind(this));
	}
	Client.prototype = {
		onError: function onError(err){
			console.log(err);
		},
		onMessage: function onMessage(text){
			var message = {
				text: text,
				time: (new Date()).getTime(),
				from: this.nicknames[this.socket.id] || Member.unknown,
				room: this.room,
				to: null,
				socketId: this.socket.id
			};
			this.delegate.send(new Commands.SendNewChatMessage(message));
		},
		onSendPreviousMessages: function onSendPreviousMessages(message, callback){
			Persistence.message.findPrevious24Hours(this.room, function(err, doc){
				if(err){
					console.log("error sending today messages", err);
				}
				return callback(doc);
			});
		},
		onNickname: function onNickname(nick, callback){
			this.socket.to(this.room).broadcast.emit('joined', this.nicknames[this.socket.id]);
			this.delegate.send(new Commands.SendNicknames({room: this.room, nicknames: this.nicknames}));
			return callback(true);
		},
		onLeft: function onLeft(user){
			debug('disconnected', user);
		},
		onDisconnect: function onDisconnect(){
			debug('disconnecting', arguments);
			this.delegate.publish(new Events.UserHasLeft({room: this.room, member: this.nicknames[this.socket.id], id: this.socket.id}));
			this.delegate.send(new Commands.SendNicknames({room: this.room, nicknames: this.nicknames}));
		},
		connect: function connect(message){
			this.socket.emit('message', message);
			this.socket.emit('connected', this.nicknames);
			this.delegate.publish(new Events.UserHasConnected({room: this.room, member: this.nicknames[this.socket.id]}));
		},
		join: function join(room){
			this.socket.join(room);
		}
	};
	
	io.on('connection', function (socket) {
		var room = getRoomFromReferrer(socket);
		var client = new Client(socket, room, nicknames, bus);
		var message = {room: room,
			text: messageOfTheDay,
			from: Member.pipbot,
			socketId: socket.id
		};
		client.connect(message);
		client.join(room);
		debug('connecting', socket.request._query.username);
	});
	return io;
};
