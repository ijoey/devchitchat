module.exports = function(grunt){
	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json")
		, watch: {
			js: {
				files: ['server.js'
					, 'resources/**/*.js']
				, tasks: ['develop']
				, options: {nospawn: true}
			}
		}
		, develop: {
			server: {
				file: 'server.js'
			}
		}
	});
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-develop');
	grunt.registerTask('default', ['develop']);
};