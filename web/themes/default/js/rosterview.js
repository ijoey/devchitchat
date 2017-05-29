(function(n, win){
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
				this.model.remove(function(i, m){
					return m.username === member.username;
				});
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
		function userJoined(key, old, v){
			if(document.getElementById(v.username)){
				return;
			}
			var elem = template.cloneNode(true);
			elem.style.display = 'block';
			elem.id = v.username;
			elem.innerHTML = joinedTemplate.render(v);
			parent.insertBefore(elem, template);
			var avatar = elem.querySelector('img');
			avatar.src = avatar.getAttribute('data-src');
		}
		function userLeft(key, old, v){
			var remove = parent.querySelector('#' + old.username);
			if(remove === null){
				return;
			}
			parent.removeChild(remove);
		}
		self.container.style.display = 'block';
		self.model.subscribe('push', userJoined);
		self.model.subscribe('pop', userLeft);
		self.model.subscribe('remove', userLeft);
		return self;
	};
})(module.exports, global)