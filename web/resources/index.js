var Datastore = require('nedb');
module.exports = function index(app, config){
	var messagesPath = config.dataPath + '/messages.db';
	function byDate(a, b){
		if(a.time === b.time) return 0;
		if(a.time > b.time) return -1;
		return 1;
	}
	app.get('/', function(req, resp, next){
		if(!req.user){
			return resp.represent({view: "index/index", resource: new app.Resource(), model: {session: req.session}});
		}
		var repo = new Datastore({filename: messagesPath, autoload: true});
		var today = new Date();
		today = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
		repo.find({"time": {$gte: today.getTime()}}, function(err, docs){
			if(err) console.log(err);
			resp.represent({view: 'index/index', resource: new app.Resource({css: ['index'], js:['index']}),
				model: docs});
		});
	});
};