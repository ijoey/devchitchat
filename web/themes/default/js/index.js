(function(n, win){
	n.CreatePageFlipper = function(container, model, delegate){
		var current = 0;
		var self = {
			container: container
			, model: model
			, divs: []
			, template: null
			, name: 'PageFlipper'
			, delegate: delegate
			, hide: function(){
				this.divs[current].style['display'] = 'none';
			}
			, show: function(){
				this.divs[current].style['display'] = 'block';
			}
			, forward: function(){
				this.flip();
			}
			, backward: function(){
				if(this.model.length === 0) return;
				this.divs[current].style['display'] = 'none';
				current--;
				if(current <= 0) current = 0;
				this.divs[current].style['display'] = 'block';
			}
			, flip: function(){
				if(this.model.length === 0) return;
				this.divs[current].style['display'] = 'none';
				current++;
				if(current >= this.model.length) current = 0;
				this.divs[current].style['display'] = 'block';
			}
			, update: function(key, old, v){
				var div = this.template.cloneNode(true);
				div.id = 'page_' + v.name;
				div.innerHTML = v.contents;			
				div.style['display'] = 'none';
				this.divs.push(div);
				this.container.parentNode.insertBefore(div, this.container);
			}
			, remove: function(key, old, v){
				var i = 0;
				var ubounds = this.divs.length;
				for(i; i < ubounds; i++){
					if(this.divs[i].id === 'page_' + v.name){
						this.divs.splice(i, 1);
						break;
					}
				}
			}
		};
		self.template = self.container.cloneNode(true);
		self.model.subscribe('push', self.update.bind(self));
		self.model.subscribe('remove', self.remove.bind(self));
		return self;
	};
	
	n.CreateMemberFlipper = function(container, model, delegate){
		var current = 0;
		var self = {
			container: container
			, model: model
			, divs: []
			, name: 'MemberFlipper'
			, template: null
			, delegate: delegate
			, hide: function(){
				this.divs[current].style['display'] = 'none';
			}
			, show: function(){
				this.divs[current].style['display'] = 'block';
			}
			, forward: function(){
				this.flip();
			}
			, backward: function(){
				if(this.model.length === 0) return;
				this.divs[current].style['display'] = 'none';
				current--;
				if(current <= 0 ) current = this.model.length - 1;
				this.divs[current].style['display'] = 'block';
			}
			, flip: function(){
				if(this.model.length === 0) return;
				this.divs[current].style['display'] = 'none';
				current++;
				if(current >= this.model.length ) current = 0;
				this.divs[current].style['display'] = 'block';
			}
			, update: function(key, old, v){
				var member = v;
				member.backgroundStyle = member.background.length > 0 ? 'background-image: url("' + member.background + '")' : '';
				member.avatarImage = member.avatar.length > 0 ? '<img class="img-circle avatar" src="' + member.avatar + '" />' : '';
				var template = Hogan.compile(this.template.outerHTML);
				var div = document.createElement('div');
				div.id = member.username;
				div.innerHTML = template.render(member);
				div.firstChild.style['display'] = 'none';
				this.divs.push(div.firstChild);
				this.container.parentNode.insertBefore(div.firstChild, this.container);
			}
			, remove: function(key, old, v){
				var i = 0;
				var ubounds = this.divs.length;
				for(i; i < ubounds; i++){
					if(this.divs[i].id === v.username){
						this.divs.splice(i, 1);
						break;
					}
				}
			}
		};
		self.template = self.container.cloneNode(true);
		self.model.subscribe('push', self.update.bind(self));
		self.model.subscribe('remove', self.remove.bind(self));
		return self;
	};
	n.CreateMemberGetter = function(delegate, model){
		var self = {
			delegate: delegate
			, model: model
			, fetch: function(callback){
				var xhr = new XMLHttpRequest();
				var self = this;
				var url = '/members.json';
				xhr.open("GET", url, true);
				xhr.onload = function(e){
					this.onload(e);
					if(callback) {
						callback(e.target);
					}
				}.bind(this);
				xhr.send();
			}
			, onload: function(e){
				var members = JSON.parse(e.target.responseText);
				members.forEach(function(member){
					this.model.push(member);
				}.bind(this));
				this.delegate.finishedGettingMembers(this);
			}
		};
		
		return self;
	};
	
	n.CreatePageGetter = function(container, model, delegate){
		var xhr = new XMLHttpRequest();
		var counter = 0;
		var self = {
			model: model
			, container: container
			, delegate: delegate
			, fetchNext: function(callback){
				var file = this.model.next();
				var url = '/pages/' + file + '.json';
				var self = this;
				xhr.open("GET", url, true);
				xhr.onload = function(e){
					this.onload(e);
					if(callback) callback(e.target);
				}.bind(this);
				xhr.send();
			}
			, onload: function(e){
				if(e.target.status !== 200) return;
				var response = JSON.parse(e.target.responseText);
				this.container.innerHTML = response.page.contents;
			}
			, show: function(){
				this.container.style['display'] = 'block';
			}
			, hide: function(){
				this.container.style['display'] = 'none';
			}
			, fetch: function(callback){
				var url = '/pages.json';
				xhr.open("GET", url, true);
				xhr.onload = function(e){
					var response = JSON.parse(e.target.responseText);
					response.files.forEach(function(file){
						this.model.push(file);
					}.bind(this));
					if(callback){
						callback(response);						
					}
					this.delegate.finishedGettingPages(this);
					
				}.bind(this);
				xhr.send();
			}
		};
		
		return self;
	};
	n.CreateViewScroller = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, left: container.querySelector('.left')
			, right: container.querySelector('.right')
			, leftClicked: function(e){
				this.delegate.leftWasClicked(e.target);
			}
			, rightCLicked: function(e){
				this.delegate.rightWasClicked(e.target);
			}
			, shiftTo: function(distance){
				this.left.style['margin-left'] = distance + 'px';
			}
		};
		self.left.addEventListener('click', self.leftClicked.bind(self), true);
		self.right.addEventListener('click', self.rightCLicked.bind(self), true);
		self.container.style['display'] = 'block';
		return self;
	};
	
	win.app = (function(win, member){
		var menu = new n.Observable({});
		var period = 15000;
		var members = new n.Observable.List([]);
		var pages = new n.Observable.List([]);
		var counter = 0;
		var flipper = null;
		var self = {
			views: []
			, interval: null
			, waiter: null
			, pageWasSelected: function(publisher, info){
				memberFlipperView.show();
				pageFlipperView.hide();
				this.stop();
				
				if(/\/(index)?$/.test(info.url)){
					this.start();
				}
			}
			, swapFlipper: function(){
				return flipper.name === 'PageFlipper' ? memberFlipperView : pageFlipperView;
			}
			, start: function(){
				this.interval = setInterval(function(){
					if(counter <= flipper.model.length){
						flipper.flip();
					}else{
						counter = 0;
						flipper.hide();
						flipper = this.swapFlipper();
						flipper.show();
					}
					counter++;
				}.bind(this), period);
			}
			, stop: function(){
				clearInterval(this.interval);
				counter = 0;
			}
			, finishedGettingMembers: function(){
				flipper = memberFlipperView;
				flipper.show();
				this.start();
			}
			, finishedGettingPages: function(){
			}
			, leftWasClicked: function(target){
				this.stop();
				flipper.backward();
				this.start();
			}
			, rightWasClicked: function(target){
				this.stop();
				flipper.forward();
				this.start();
			}
			, menuHasOpened: function(publisher, info){
				carouselNavigation.shiftTo(100);
			}
			, menuHasClosed: function(publisher, info){
				carouselNavigation.shiftTo(0);
			}
			, member: null
			, members: members
			, pages: pages
		};
		var pageTemplate = document.createElement('div');
		var main = document.getElementById('main');
		pageTemplate.className = 'pages';
		main.appendChild(pageTemplate);
		var memberFlipperView = n.CreateMemberFlipper(document.getElementById('{{username}}'), members);
		var pageFlipperView = n.CreatePageFlipper(pageTemplate, pages);
		var memberGetter = n.CreateMemberGetter(self, members);
		var pageGetter = n.CreatePageGetter(document.getElementById('main'), pages, self);
		var carouselNavigation = n.CreateViewScroller(document.getElementById('carouselControls'), null, self);
		memberGetter.fetch();
		pageGetter.fetch();
		n.NotificationCenter.subscribe('pageWasSelected', self, null);
		n.NotificationCenter.subscribe('menuHasOpened', self, null);
		n.NotificationCenter.subscribe('menuHasClosed', self, null);
		return self;
	})(win);
})(MM, window);
