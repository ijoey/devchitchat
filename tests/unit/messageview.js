const test = require("tap").test;
const fs = require('fs')
const path = require('path')
const previewTemplate = fs.readFileSync(path.join(path.dirname(__dirname).replace('/tests', ''), '/web/themes/default/templates/preview.html'), {encoding: 'utf-8'})

test("Message is previewed by the person entering it", (t) => {
    const message = {
        from: {}
        , text: "some message"
    }

    t.ok(MessagePreview.text === message.text)
    t.end()
})
