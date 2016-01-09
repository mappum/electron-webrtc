var test = require('tape')
var Peer = require('simple-peer')

var wrtc
test('create daemon', t => {
  wrtc = require('..')()
  wrtc.electronDaemon.once('ready', t.end)
})

var p1
var p2
test('create simple-peers', t => {
  p1 = new Peer({ wrtc, initiator: true })
  p2 = new Peer({ wrtc })
  p1.on('signal', data => p2.signal(data))
  p2.on('signal', data => p1.signal(data))
  p2.on('connect', t.end)
})

test('send data', t => {
  var message = 'hello peer'
  p1.send(message)
  p2.on('data', data => {
    t.equals(data, message)
    t.end()
  })
})

test('cleanup', t => {
  function tryDone () {
    if (!p1.connected && !p2.connected) {
      t.pass('both peers closed')
      wrtc.electronDaemon.close()
      t.end()
    }
  }
  p1.destroy(tryDone)
  p2.destroy(tryDone)
})
