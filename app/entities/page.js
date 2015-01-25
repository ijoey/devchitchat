function Page(name, contents){
	this.name = name ? name.replace(/\.\w+$/, '') : null;
	this.contents = contents;
}
module.exports = Page;