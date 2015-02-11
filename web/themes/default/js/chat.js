(function(n, win){
	function debug(level){
		console.log(arguments);
	}	
	n.MessageView = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, field: container.querySelector("[name='message']")
			, form: container.querySelector('form')
			, button: null
			, offset: {top: container.offsetTop}
			, resize: function(viewportSize){
				//self.top = viewportSize.h - 40;
			}
			, handleEvent: function(e){
				if(this[e.type]){
					this[e.type](e);
				}
			}
			, submit: function(e){
				e.preventDefault();
				this.model.from = this.model.to;
				this.model.time = (new Date()).getTime();
				this.model.text = this.field.value;
				if(this.delegate.messageWasSubmitted) {
					this.delegate.messageWasSubmitted(model);
				}
				this.model.text = '';
			}
			, keydown: function(e){
				if(e.keyCode === 13){
					this.button.click();
				}
			}
			, release: function(){
				this.field.removeEventListener('keydown', this);
				this.form.removeEventListener('submit', this);
			}
		};
		self.button = self.form.querySelector('button');
		Object.defineProperty(self, 'top', {
			get: function(){return parseInt(self.field.style.top.replace('px', ''), 10);}
			, set: function(v){ self.field.style.top = v+'px';}
			, enumerable: true
		});
		function textDidChange(key, old, v){
			self.field.value = v;
		}

		self.field.addEventListener("keydown", self, true);
		self.form.addEventListener('submit', self, true);
		self.model.subscribe("text", textDidChange);
		self.field.focus();
		return self;
	};
	
	
	n.RosterView = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, joined: function(member){
				if(!this.model.find(function(m){
					return m.username === member.username;
				}.bind(this))){
					this.model.push(member);
				}
			}
			, left: function(member){
				for(var i = 0; i< this.model.length; i++){
					if(this.model.item(i).username === member.username) this.model.splice(i, 1);
				}
			}
			, connected: function(nicknames){
				for(var name in nicknames){
					if(!this.model.find(function(m){return m.username === name;})){
						this.model.push(nicknames[name]);
					}
				}
			}
		};
		
		var parent = container.querySelector('ul');
		var template = container.querySelector('ul li:first-child');
		var joinedTemplate = Hogan.compile(template.innerHTML);
		template.style.display = 'none';
		function userJoined(key, old, v, m){
			if(document.getElementById(v.username)) return;
			var elem = template.cloneNode(true);
			elem.style.display = 'block';
			elem.id = v.username;
			elem.innerHTML = joinedTemplate.render(v);
			parent.insertBefore(elem, template);
			var avatar = elem.querySelector('img');
			avatar.src = avatar.getAttribute('data-src');
		}
		function userLeft(key, old, v, m){
			old.forEach(function(member){
				var remove = parent.querySelector('#' + member.username);
				parent.removeChild(remove);
			});
		}		
		self.container.style.display = 'block';
		self.model.subscribe('push', userJoined);
		self.model.subscribe('pop', userLeft);
		self.model.subscribe('splice', userLeft);
		return self;
	};
	n.DiscussionView = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, messageWasSubmitted: function(message){}
			, message: function(message){
				if(message && message.text && message.text.length > 0){
					if(this.delegate && this.delegate.messageWasReceived){
						this.delegate.messageWasReceived(message);
					}
					this.model.push(new n.Observable(new n.Message(message)));
				}
			}
		};
		var template = container.querySelector(".discussion li");
		var discussion = container.querySelector('.discussion');
		template.style.display = 'none';
		var messageTemplate = Hogan.compile(template.innerHTML);
		var lastTimeMessageWasSent = (new Date()).getTime();
		var hooks = [];
		function hookForImages(message){
			message.text = message.text.replace(/https?:\/\/.*?\.(?:png|jpg|jpeg|gif)(#.*)?(&.*)?#\.png/ig, '<img src="$&" />');
			return message;
		}
		function hookGithubResponse(message){
			try{
				var users = JSON.parse(message.text);
				if(users.what === 'github list of users'){
					message.text = '<ul>';
					users.items.forEach(function(user){
						message.text += '<li><a href="' + user.html_url + '"><img class="img-circle avatar" src="' + window.location.origin + user.avatar_url + '" /></a></li>';
					});
					message.text += '</ul>';
				}
			}catch(e){
			}
			return message;
		}
		function hookListOfUsers(message){
			try{
				var users = JSON.parse(message.text);
				if(users.what === 'list of users'){
					message.text = '<ul>';
					for(key in users){
						if(!users[key].avatar) continue;
						message.text += '<li><img class="img-circle avatar" src="' + window.location.origin + users[key].avatar + '" /></a></li>';
					}
					message.text += '</ul>';
				}
			}catch(e){
			}
			return message;
		}
		function hookGsearchResultClass(message){
			if(message.text.indexOf('GsearchResultClass') === -1) return message;
			var result = JSON.parse(message.text);
			var searchResult = result.responseData.results;
			message.text = '';
			searchResult.forEach(function(s){
				message.text += '<img src="{src}" width="200" />'.replace(/{src}/, s.unescapedUrl);
			});
			return message;
		}
		function includeHttp(url){
			if(url.indexOf('http') > -1){
				return url;
			}
			return 'http://' + url;
		}
		function hookForLinks(message){
			message.text = URI.withinString(message.text, function(url){
				return '<a href="' + includeHttp(url) + '" target="_blank">' + url + '</a>';
			});
			return message;
		}
		hooks.push({execute: hookForLinks});
		hooks.push({execute: hookGsearchResultClass});
		hooks.push({execute: hookGithubResponse});
		hooks.push({execute: hookListOfUsers});
		hooks.push({execute: hookForImages});
		function messageWasAdded(key, old, v, m){
			if(!v) return;
			if(!v.from) return;
			var lastMessage = discussion.querySelector("[data-from='" + v.from._id + "']:first-child");
			var elem = template.cloneNode(true);
			elem.setAttribute('data-from', v.from._id);
			elem.style.display = 'block';
			hooks.forEach(function(hook){
				v = hook.execute(v);
			});
			if(lastMessage === null){
				elem.innerHTML = messageTemplate.render(v);				
				var first = discussion.querySelector('.discussion li:first-child');
				if(delegate.member.username === v.from.username){
					elem.className = 'self';
				}
				var avatar = elem.querySelector('img');
				avatar.src = avatar.getAttribute('data-src');
				var time = document.createElement('li');
				time.className = 'sent';
				time.innerHTML = '<time>' + v.sent(lastTimeMessageWasSent) + '</time>';
				discussion.insertBefore(elem, first);
				discussion.insertBefore(time, first);
			}else{
				var messages = template.querySelector('.message').cloneNode(true);
				var sameUserMessage = Hogan.compile(messages.innerHTML);
				messages.innerHTML = sameUserMessage.render(v);
				lastMessage.insertBefore(messages, lastMessage.querySelector('.message'));
			}
			lastTimeMessageWasSent = v.time;
		}
		function messageWasRemoved(key, old, v){
			var last = container.querySelector(".discussion:last-child");
			container.removeChild(last);
		}
		
		self.model.subscribe('push', messageWasAdded);
		self.model.subscribe('pop', messageWasRemoved);
		return self;
	};	

	n.Message = function(obj){
		this.text = '';
		this.to = null;
		this.from = null;
		this.time = null;
		this.room = null;
		for(var key in obj){
			this[key] = obj[key];
		}
	};
	n.Message.prototype = {
		sent: function(lastTimeSent){
  		  var date = new Date(this.time);
  		  if((this.time - lastTimeSent)/1000 > 60*1)
  		  return 'mm/dd/yyyy h:m t'.replace('mm', date.getMonth() + 1)
  		 	 .replace('dd', date.getDate() > 9 ? date.getDate() : '0' + date.getDate())
  			 .replace('yyyy', date.getFullYear())
  			 .replace('h', date.getHours() - 12 < 0 ? date.getHours() : date.getHours() - 12)
  			 .replace('m', date.getMinutes()> 9 ? date.getMinutes() : '0' + date.getMinutes())
  			 .replace('t', date.getHours() > 11 ? 'PM' : 'AM');
  		  return "";
		}
	};
	
	n.Member = function(obj){
		this.username = null;
		this.avatar = null;
		this.name = null;
		this.displayName = null;
	  for(var key in obj){
		  this[key] = obj[key];
	  }
	};
	var app = function(){
		var views = [];
		var message = new n.Observable(new n.Message({text: null, to: {name: win.member.displayName, username: win.member ? win.member.username : null, avatar: win.member ? win.location.origin + win.member.avatar : null}}));
		var messages = new n.Observable.List();
		var roster = new n.Observable.List();
		var self = {};
		var Permissions = {
			DEFAULT: 'default'
			, GRANTED: 'granted'
			, DENIED: 'denied'
		};
		var isNotificationsOn = false;
		
		self.release = function(e){
			views.forEach(function(v){
				if(v.release){
					v.release();					
				}
			});
			if(win.member){
				socket.emit('left', {username: win.member.username});
				socket.removeAllListeners('connect');
				socket.removeAllListeners('nicknames');
				socket.removeAllListeners('message');
				socket.removeAllListeners('reconnect');
				socket.removeAllListeners('reconnecting');
				socket.removeAllListeners('error');
				socket.removeAllListeners('left');
			}
		};
		self.messageWasReceived = function(message){
			return message;
		};
		self.messageWasSubmitted = function(model){
			views.forEach(function(v){
				if(v.messageWasSubmitted){
					v.messageWasSubmitted(model);
				}
			});
			if(model.text && model.text.length > 0){
				socket.emit('message', model.text);
			}
		};
		self.connected = function(nicknames){
			views.forEach(function(v){
				if(v.connected){
					v.connected(nicknames);
				}
			});
		};
		self.joined = function(member){
			views.forEach(function(v){
				if(v.joined){
					v.joined(member);
				}
			});
		};
		self.nicknames = function(nicknames){
			views.forEach(function(v){
				if(v.nicknames){
					v.nicknames(nicknames);
				}
			});
		};
		self.message = function(message){
			if(typeof message === 'string'){
				message = {text: message, from: {name: 'FromSomewhereElse', username: 'chat server', avatar: '/public/images/penguins.jpg'}};
			}
			if(isNotificationsOn && message.from.username !== win.member.username){
				var n = new Notification(message.from.displayName || message.from.name, {body: message.text, tag: "notifyUser", icon: message.from.avatar});
			}
			views.forEach(function(v){
				message.to = {username: win.member.username, name: win.member.displayName, avatar: win.location.origin + win.member.avatar};
				if(v.message){
					v.message(message);
				}
			});
		};
		self.reconnect = function(protocol, flag){
			debug(0, 'reconnect->', arguments);			
		    socket.emit('nickname', win.member.username, function(exists){
		    	roster.push({username: win.member.username, name: win.member.displayName, avatar: win.location.origin + win.member.avatar});
		    });
		};
		self.reconnecting = function(someNumber, flag){
			debug(0, 'reconnecting->', arguments);			
		};
		self.error = function(){
			debug(0, 'error->', arguments);
		};
		self.left = function(member){
			views.forEach(function(v){
				if(v.left) v.left(member);
			});
			if(member === win.member.username){
				console.log("you've been disconnected from the IRC server");
			}
		};
		self.handleEvent = function(e){
			if(self[e.type]) self[e.type](e);
		};
		self.resize = function(e){
			views.forEach(function(v){
				if(v.resize) v.resize({h: e.target.document.documentElement.clientHeight, w: e.target.document.documentElement.clientWidth});
			});
		};
		self.CustomerSignedUpForEmail = function(email){
			console.log(email);
		};
		self.requestNotificationPermission = function(){
			if(!('Notification' in window)){
				isNotificationsOn = false;
				return isNotificationsOn;
			}
			isNotificationsOn = Notification.permission === Permissions.GRANTED;
			if(Notification.permission !== Permissions.DENIED && !isNotificationsOn){
				Notification.requestPermission(function(p){
					if(p === Permissions.GRANTED){
						isNotificationsOn = true;
					}
				})
			}
		};
		self.member = win.member;
		
		self.requestNotificationPermission();
		var socket;
		if(win.member){
			socket = io.connect('', {query: 'username=' + win.member.username});
			socket.on('connected', self.connected);
			socket.on('left', self.left);
			socket.on('joined', self.joined);
			socket.on('nicknames', self.nicknames);
			socket.on('message', self.message);
			socket.on('reconnect', self.reconnect);
			socket.on('reconnecting', self.reconnecting);
			socket.on('error', self.error);
			socket.on('CustomerSignedUpForEmail', self.CustomerSignedUpForEmail);
			var messageView = null;
			views.push(n.DiscussionView(document.getElementById('messagesView'), messages, self));
			views.push(n.RosterView(document.getElementById('rosterView'), roster, self));
			views.push(messageView = n.MessageView(document.getElementById("comment"), message, self));
			messageView.resize({h: window.document.documentElement.clientHeight, w: window.document.documentElement.clientWidth})
			win.addEventListener('resize', self, true);
			
		    socket.emit('nickname', win.member.username, function(exists){
		    	roster.push({username: win.member.username, name: win.member.displayName, avatar: win.location.origin + win.member.avatar});
		    });
			socket.emit('send previous messages', 'hello?', function(list){
				if(!list){
					return;
				}
				list.forEach(function(m){
					console.log(new n.Message(m));
					messages.push(new n.Message(m));
				});
			});
		}
		win.addEventListener('unload', self.release);		
		return self;
	}();
})(MM, window);