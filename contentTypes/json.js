module.exports = (function json(){
	return {
		key: "application/json"
		, execute: function(filePath, represent, result, callback){
			callback(JSON.stringify(result.model));
		}
	};
})();