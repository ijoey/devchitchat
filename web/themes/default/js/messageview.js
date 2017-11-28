(function(n, win){
    n.MessageView = function(container, model, delegate){
        var typingTimestamp = new Date();
        var typingTimer = null;
        var defaultStyle = {
            position: container.style.position,
            top: container.style.top
        };
        var interval = null;
        function startTimer(){
            n.NotificationCenter.publish(n.Events.HAS_STARTED_TYPING, self, null);
            interval = setInterval(function(){
                if(self.field.value.length === 0){
                    typingTimer = null;
                    n.NotificationCenter.publish(n.Events.HAS_STOPPED_TYPING, self, null);
                    clearInterval(interval);
                }
            }, 3000);
            return new Date();
        }
        function stopTimer(){
            typingTimer = null;
            clearInterval(interval);
            n.NotificationCenter.publish(n.Events.HAS_STOPPED_TYPING, self, null);
        }
        var self = {
            container: container,
            model: model,
            delegate: delegate,
            field: container.querySelector("[name='message']"),
            form: container.querySelector('form'),
            button: null,
            offset: {top: container.offsetTop},
            resize: function(viewportSize){
                //self.top = viewportSize.h - 40;
            },
            sendMessage: function(){
                this.model.from = this.model.to;
                this.model.time = (new Date()).getTime();
                this.model.text = this.field.value;
                if(/^\[.*\]/.test(this.model.text)){
                    this.model.text = this.model.text.replace(/] /, "]\n");
                }
                this.delegate.messageWasSubmitted(this.model);
                n.NotificationCenter.publish(n.Events.THIS_USER_HAS_SENT_A_MESSAGE, this, this.model);
                if(typingTimer !== null){
                    stopTimer();
                }
                typingTimestamp = new Date();
                this.model.text = '';
                this.field.value = '';
            },
            handleEvent: function(e){
                if(this[e.type]){
                    this[e.type](e);
                }
            },
            paste: function(e){
                if(!e.clipboardData.items){
                    return;
                }
                if(e.clipboardData.items.length === 0){
                    return;
                }
                if(e.clipboardData.items[0].type.indexOf('image/') === -1){
                    return;
                }
                e.preventDefault();
                var file = e.clipboardData.items[0].getAsFile();
                var reader = new FileReader();
                reader.onload = function(evt) {
                    this.model.text = evt.target.result;
                    this.sendMessage();
                }.bind(this);
                reader.readAsDataURL(file);
            },
            submit: function(e){
                e.preventDefault();
                this.sendMessage();
            },
            keyup: function(e){
                typingTimestamp = new Date();
                if(typingTimer === null){
                    typingTimer = startTimer();
                }
                if(e.keyCode === 13){
                    this.button.click();
                }
                this.model.text = this.field.value;
            },
            release: function(){
                this.field.removeEventListener('keyup', this);
                this.form.removeEventListener('submit', this);
            },
            scrolling: function scrolling(e){
                if(win.scrollY > 0){
                    if(this.container.style.position !== 'fixed'){
                        this.container.style.position = 'fixed';
                        this.container.style.top = '0';
                    }
                }else if(this.container.style.position !== defaultStyle.position){
                    this.container.style.position = defaultStyle.position;
                    this.container.style.top = defaultStyle.top;
                }
            },
            messageWasDoubleClicked: function messageWasDoubleClicked(message){
                message.text = message.text.replace('<br>', ' ');
                this.field.value = '[' + message.text + ' from ' + message.from.displayName + '] ';
                this.field.focus();
            }
        };
        win.addEventListener('scroll', self.scrolling.bind(self), true);
        self.button = self.form.querySelector('button');
        Object.defineProperty(self, 'top', {
            get: function(){return parseInt(self.field.style.top.replace('px', ''), 10);}
            , set: function(v){ self.field.style.top = v+'px';}
            , enumerable: true
        });

        self.field.addEventListener("keyup", self, true);
        self.form.addEventListener('submit', self, true);
        self.form.addEventListener('paste', self, true);
        self.field.focus();
        return self;
    };
})(module.exports, global)
