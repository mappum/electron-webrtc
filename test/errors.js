var test = require('tap').test

var wrtc
test('create daemon', (t) => {
  wrtc = require('..')()
  wrtc.electronDaemon.once('ready', t.end)
})

test('create RTCPeerConnection after close', (t) => {
  wrtc.on('error', (err) => {
    t.ok(err, 'error emitted')
    t.end()
  })

  wrtc.close()
  var pc = new wrtc.RTCPeerConnection()
  pc
})
