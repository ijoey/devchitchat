var Http = require('http');
var Member = require('../app/entities/member');
var Message = require('../app/entities/message');
var debug = require('debug')('pipbot');
function PipBot(config, Persistence, delegate){
	return {
		update: function update(event){
			if(this.canRespondTo(event.body)){
				this.execute(event.body, function(message){
					Persistence.message.save(message, function(err, doc){
						if(err){
							console.log('error occurred persisting message from pipbot', err, doc);
						}
					});
					delegate.sendTo(event.body.room, message);
				});
			}
		},
		canRespondTo: function canRespondTo(message){
			return /^pipbot/.test(message.text);
		},
		execute: function(message, callback){
			var m = new Message({text: 'ok',
				room: message.room,
				from: Member.pipbot,
				time: new Date()
			});
		
			var request = message.text.replace(/^pipbot /, '');
			var match = /google\.images\.find\([\'|\"](.+)[\'|\"]\)/ig.exec(request);
			var limitMatch = /\.limit\((\d+)\)/ig.exec(request);
			debug('limitMatch', limitMatch);
			debug('match', match);
			if(match !== null){
				this.getImages(match[1], function(urls){
					if(urls.length == 0){
						m.text = 'No images found';
						return callback(m);
					}
					var list = urls.map(function(url){
						return '<img src="' + url + '" class="external" />';
					});
					if(limitMatch){
						list = list.splice(0, parseInt(limitMatch[1]));
					}
					m.text = list.join('\n');
					m.isHtml = true;
					callback(m);
				});
			}else{
				callback(m);				
			}
		},
		getImages: function(term, callback){
			var data = '';
			Http.request({
				hostname: 'ajax.googleapis.com',
				method: 'GET',
				path: '/ajax/services/search/images?v=1.0&rsz=8&q=' + encodeURIComponent(term)
			}, function(res){
				res.setEncoding('utf8');
				res.on('data', function(chunk){
					data += chunk;
				});
				res.on('end', function(){
					var results = [];
					try{
						results = JSON.parse(data).responseData.results;
					}catch(e){
						console.log(e);
					}
					if(results.length > 0){
						callback(results.map(function(image, i){
							return image.unescapedUrl;
						}));
					}else{
						callback([]);
					}
				});
			}).on('error', function(err){
				console.log(err);
			}).end();
		}
	};
}
module.exports = PipBot;