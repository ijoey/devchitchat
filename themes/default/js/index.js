(function(win){
	function debug(level){
		console.log(arguments);
	}	
	
	View.Message = function(container, model){
		var self = View.apply(this, [container, model]);
		this.field = this.container.querySelector("[name='message']");
		this.form = this.container.querySelector('form');
		this.button = this.form.querySelector('button');
		this.offset = {top: container.offsetTop};
		Object.defineProperty(this, 'top', {
			get: function(){return parseInt(this.field.style.top.replace('px', ''), 10);}
			, set: function(v){ this.field.style.top = v+'px';}
			, enumerable: true
		});
		function textDidChange(key, old, v){
			self.field.value = v;
		}
		model.subscribe("text", textDidChange);
		this.field.focus();
		return this;
	};
	View.Roster = function(container, model){
		var self = View.apply(this, [container, model]);
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
		model.subscribe('push', userJoined);
		model.subscribe('pop', userLeft);
		model.subscribe('splice', userLeft);
		return this;
	};
	View.Discussion = function(container, model){
		var self = View.apply(this, [container, model]);
		var template = container.querySelector(".discussion li");
		var discussion = container.querySelector('.discussion');
		template.style.display = 'none';
		var messageTemplate = Hogan.compile(template.innerHTML);
		var lastTimeMessageWasSent = (new Date()).getTime();
		var filters = [];		
		function filterForImages(message){
			message.text = message.text.replace(/https?:\/\/.*?\.(?:png|jpg|jpeg|gif)(#.*)?(&.*)?#\.png/ig, '<img src="$&" />');
			return message;
		}
		function filterGithubResponse(message){
			try{
				var users = JSON.parse(message.text);
				if(users.what === 'github list of users'){
					message.text = '<ul>';
					users.items.forEach(function(user){
						message.text += '<li><a href="' + user.html_url + '"><img src="' + user.avatar_url + '" /></a></li>';
					});
					message.text += '</ul>';
				}
			}catch(e){
			}
			return message;
		}
		function filterListOfUsers(message){
			try{
				var users = JSON.parse(message.text);
				if(users.what === 'list of users'){
					message.text = '<ul>';
					for(key in users){
						if(!users[key].profile_image_url) continue;
						message.text += '<li><img src="' + users[key].profile_image_url + '" /></a></li>';
					}
					message.text += '</ul>';
				}
			}catch(e){
			}
			return message;			
		}
		filters.push({execute: filterGithubResponse});
		filters.push({execute: filterListOfUsers});
		filters.push({execute: filterForImages});
		
		function messageWasAdded(key, old, v, m){
			if(!v) return;
			if(!v.from) return;
			var lastMessage = discussion.querySelector("[data-from='" + v.from.username + "']:first-child");
			var elem = template.cloneNode(true);
			elem.setAttribute('data-from', v.from.username);
			elem.style.display = 'block';
			filters.forEach(function(filter){
				v = filter.execute(v);
			});
			if(lastMessage === null){
				elem.innerHTML = messageTemplate.render(v);				
				var first = discussion.querySelector('.discussion li:first-child');
				if(v.to.username === v.from.username){
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
		
		model.subscribe('push', messageWasAdded);
		model.subscribe('pop', messageWasRemoved);
		return this;
	};
	Controller.Roster = function(delegate, view, model){
		var self = Controller.apply(this, [delegate, view, model]);
		this.joined = function(member){
			if(!model.exists(function(m){
				return m.username === member.username;
			})){
				model.push(member);
			}
		};
		this.left = function(member){
			for(var i = 0; i<model.length; i++){
				if(model[i].username === member.username) model.splice(i, 1);
			}
		};
		this.connected = function(nicknames){
			for(var name in nicknames){
				if(!model.exists(function(m){return m.username === name;})){
					model.push(nicknames[name]);
				}
			}
		};
		
		return this;
	};
	
	Controller.Message = function(delegate, view, model){
		var self = Controller.apply(this, [delegate, view, model]);
		view.field.addEventListener("keyup", this, true);
		view.form.addEventListener('submit', this, true);
		view.field.addEventListener('focus', this, true);
		this.resize = function(viewportSize){
			view.top = viewportSize.h - 40;
		};
		this.handleEvent = function(e){
			if(this[e.type]) this[e.type](e);
		};
		this.submit = function(e){
			e.preventDefault();
			model.from = model.to;
			model.time = (new Date()).getTime();
			if(delegate.messageWasSubmitted) delegate.messageWasSubmitted(model);
			model.text = "";
		};
		this.keyup = function(e){
			if(!e.shiftKey && e.keyCode === 13){
				view.button.click();
			}else{
				model.text = e.target.value;				
			}
		};
		this.release = function(){
			view.field.removeEventListener('keyup', this);
			view.form.removeEventListener('submit', this);
		};
		return this;
	};
	Controller.Discussion = function(delegate, view, model){
		var self = Controller.apply(this, [delegate, view, model]);
		this.messageWasSubmitted = function(message){
			if(message && message.text.length > 0) model.push(message);
		};
		this.message = function(message){
			if(message && message.text.length > 0){
				if(this.delegate && this.delegate.messageWasReceived) this.delegate.messageWasReceived(message);
				model.push(new Model.Message(message));
			}
		};
		return this;
	};
	Model.List = function(obj){
  	  var self = Model.apply(this, [obj]);
	  var internal = [];
	  this.push = function(item){
		  self.changed('push', null, item, this);
		  internal.push(item);
	  };
	  this.pop = function(){
		  var old = internal.pop();
		  self.changed('pop', old, null, this);
		  return old;
	  };
	  this.indexOf = function(key){
		  return internal.indexOf(key);
	  };
	  this.splice = function(index, howMany){
		  var removed = internal.splice(index, howMany);
		  self.changed('splice', removed, null, this);
		  return removed;
	  };
	  this.exists = function(fn){
		  var i =0;
		  var ubounds = internal.length;
		  for(i;i<ubounds;i++){
			  if(fn(internal[i])) return true;
		  }
		  return false;
	  };
	  return this;
	};
	Model.Message = function(obj){
	  var self = Model.apply(this, [obj]);
	  var text = null;
	  Object.defineProperty(this, "text", {
	    get: function(){return text;}
	    , set: function(v){
	      var old = text;
	      self.changed("text", old, v, self);
	      text = v;
	    }
  		, enumerable: true
	  });
	  var to = null;
	  Object.defineProperty(this, 'to', {
		  get: function(){return to;}
		  , set: function(v){
			  var old = to;
			  self.changed('to', old, v, self);
			  to = v;
		  }
		  , enumerable: true
	  });
	  var from = null;
	  Object.defineProperty(this, 'from', {
		  get: function() {return from;}
		  , set: function(v){
			  var old = from;
			  self.changed('from', old, v, self);
			  from = v;
		  }
		  , enumerable: true
	  });
	  var time = new Date();
	  Object.defineProperty(this, 'time', {
		  get: function(){return time;}
		  , set: function(v){
			  var old = time;
			  self.changed('time', old, v, self);
			  time = v;
		  }
		  , enumerable: true
	  });
	  for(var key in obj) this[key] = obj[key];
	  this.sent = function(lastTimeSent){
		  var date = new Date(time);
		  if((time - lastTimeSent)/1000 > 60*.2)
		  return 'mm/dd/yyyy h:m t'.replace('mm', date.getMonth() + 1)
		 	 .replace('dd', date.getDate() > 9 ? date.getDate() : '0' + date.getDate())
			 .replace('yyyy', date.getFullYear())
			 .replace('h', date.getHours() - 12 < 0 ? date.getHours() : date.getHours() - 12)
			 .replace('m', date.getMinutes()> 9 ? date.getMinutes() : '0' + date.getMinutes())
			 .replace('t', date.getHours() > 11 ? 'PM' : 'AM');
		  return "";
	  };
	  return this;
	};
	Model.Member = function(obj){
  	  var self = Model.apply(this, [obj]);
	  var token = null;
	  Object.defineProperty(this, "token", {
	    get: function(){return token;}
	    , set: function(v){
	      var old = token;
	      self.changed("token", old, v, self);
	      token = v;
	    }
		, enumerable: true
	  });
	  var username = null;
	  Object.defineProperty(this, "username", {
	    get: function(){return username;}
	    , set: function(v){
	      var old = username;
	      self.changed("username", old, v, self);
	      username = v;
	    }
		, enumerable: true
	  });
	  var profile_image_url = null;
	  Object.defineProperty(this, "profile_image_url", {
	    get: function(){return profile_image_url;}
	    , set: function(v){
	      var old = profile_image_url;
	      self.changed("profile_image_url", old, v, self);
	      profile_image_url = v;
	    }
		, enumerable: true
	  });
	  var name = null;
	  Object.defineProperty(this, "name", {
	    get: function(){return name;}
	    , set: function(v){
	      var old = name;
	      self.changed("name", old, v, self);
	      name = v;
	    }
		, enumerable: true
	  });
	  
	  for(var key in obj){
		  this[key] = obj[key];
	  }
	  return this;
	};
	var app = function(){
		var controllers = [];
		var message = new Model.Message({text: null, to: {token: win.member.token, name: win.member.profile.displayName, username: win.member ? win.member.profile.username : null, profile_image_url: win.member ? win.member.profile._json.profile_image_url : null}});
		var messages = new Model.List();
		var roster = new Model.List();
		var self = {};
		self.release = function(e){
			controllers.forEach(function(c){
				c.release();
			});
			if(win.member){
				socket.emit('left', {username: win.member.profile.username});
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
			controllers.forEach(function(c){
				if(c.messageWasSubmitted) c.messageWasSubmitted(model);
			});
			if(model.text.length > 0) socket.emit('message', model.text);
		};
		self.connected = function(nicknames){
			controllers.forEach(function(c){
				if(c.connected) c.connected(nicknames);
			});
		};
		self.joined = function(member){
			controllers.forEach(function(c){
				if(c.joined) c.joined(member);
			});
		};
		self.nicknames = function(nicknames){
			controllers.forEach(function(c){
				if(c.nicknames) c.nicknames(nicknames);
			});
		};
		self.message = function(message){
			controllers.forEach(function(c){
				message.to = {username: win.member.profile.username, name: win.member.profile.displayName, token: win.member.token, profile_image_url: win.member.profile._json.profile_image_url};
				if(c.message) c.message(message);
			});
		};
		self.reconnect = function(protocol, flag){
			debug(0, 'reconnect->', arguments);			
		    socket.emit('nickname', win.member.token, function(exists){
		    	roster.push(new Model.Member({username: win.member.profile.username, name: win.member.profile.displayName, token: win.member.token, profile_image_url: win.member.profile._json.profile_image_url}));
		    });
		};
		self.reconnecting = function(someNumber, flag){
			debug(0, 'reconnecting->', arguments);			
		};
		self.error = function(){
			debug(0, 'error->', arguments);
		};
		self.left = function(member){
			controllers.forEach(function(c){
				if(c.left) c.left(member);
			});
		};
		self.handleEvent = function(e){
			if(self[e.type]) self[e.type](e);
		};
		self.resize = function(e){
			controllers.forEach(function(c){
				if(c.resize) c.resize({h: e.target.document.documentElement.clientHeight, w: e.target.document.documentElement.clientWidth});
			});
		};
		
		var socket;
		if(win.member){
			socket = io.connect('', {query: 'token=' + win.member.token});
			socket.on('connected', self.connected);
			socket.on('left', self.left);
			socket.on('joined', self.joined);
			socket.on('nicknames', self.nicknames);
			socket.on('message', self.message);
			socket.on('reconnect', self.reconnect);
			socket.on('reconnecting', self.reconnecting);
			socket.on('error', self.error);
			var messageController = null;
			controllers.push(new Controller.Discussion(self, new View.Discussion(document.getElementById('messagesView'), messages), messages));
			controllers.push(new Controller.Roster(self, new View.Roster(document.getElementById('rosterView'), roster), roster));
			controllers.push(messageController = new Controller.Message(self, new View.Message(document.getElementById("comment"), message), message));
			messageController.resize({h: window.document.documentElement.clientHeight, w: window.document.documentElement.clientWidth})
			win.addEventListener('resize', self, true);
			
		    socket.emit('nickname', win.member.token, function(exists){
		    	roster.push(new Model.Member({username: win.member.profile.username, name: win.member.profile.displayName, token: win.member.token, profile_image_url: win.member.profile._json.profile_image_url}));
		    });
			socket.emit('send previous messages', 'hello?', function(list){
				list.forEach(function(m){
					messages.push(new Model.Message({text: m.message, to: win.member.profile, from: m.author}));
				});
			});
		}
		win.addEventListener('unload', self.release);		
		return self;
	}();
})(window);