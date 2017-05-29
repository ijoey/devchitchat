(function(n, win){
    n.PreviewView = function(container, model, delegate){
		var self = {
			container: container,
			model: model,
			delegate: delegate,
			text: container.querySelector('.message .text'),
			update: function update(key, old, v){
				this.text.innerHTML = v;
			},
			show: function show(){
				this.container.style.display = 'block';
			},
			hide: function hide(){
				this.container.style.display = 'none';
			}
		};
		container.style.display = 'none';
		container.style.position = 'absolute';
		container.style.top = '50px';
		container.style.right = '20px';
		self.model.subscribe('text', self.update.bind(self));

		n.NotificationCenter.subscribe(n.Events.HAS_STARTED_TYPING, {HAS_STARTED_TYPING: function(){
			this.show();
		}.bind(self)}, null);

		n.NotificationCenter.subscribe(n.Events.HAS_STOPPED_TYPING, {HAS_STOPPED_TYPING: function(){
			this.hide();
		}.bind(self)}, null);

		return self;
	};
})(module.exports, global);