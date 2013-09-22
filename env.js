var fs = require('fs');
var data = fs.readFileSync('dev.env', 'utf8');
var env = {};
data.split(/\n/).forEach(function(line){
	var match = line.match(/^([^=:]+?)[=\:](.*)/);
	if(match[0]) env[match[1]] = match[2];
});
module.exports = env;