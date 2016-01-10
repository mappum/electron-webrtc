var test = require('tape')
var Peer = require('simple-peer')

var wrtc
test('create daemon', t => {
  wrtc = require('..')()
  wrtc.electronDaemon.once('ready', t.end)
})

test('signal event gets emitted', t => {
  var peer = new Peer({ initiator: true, wrtc: wrtc })
  peer.once('signal', () => {
    t.pass('got signal event')
    peer.destroy()
    t.end()
  })
})

test('data send/receive text', t => {
  var peer1 = new Peer({ initiator: true, wrtc: wrtc })
  var peer2 = new Peer({ wrtc: wrtc })

  var numSignal1 = 0
  peer1.on('signal', data => {
    numSignal1 += 1
    peer2.signal(data)
  })

  var numSignal2 = 0
  peer2.on('signal', data => {
    numSignal2 += 1
    peer1.signal(data)
  })

  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest () {
    if (!peer1.connected || !peer2.connected) return

    t.ok(numSignal1 >= 1)
    t.ok(numSignal2 >= 1)
    t.equal(peer1.initiator, true, 'peer1 is initiator')
    t.equal(peer2.initiator, false, 'peer2 is not initiator')

    t.equal(peer1.localAddress, peer2.remoteAddress)
    t.equal(peer1.localPort, peer2.remotePort)

    t.equal(peer2.localAddress, peer1.remoteAddress)
    t.equal(peer2.localPort, peer1.remotePort)

    t.ok(typeof peer1.remoteFamily === 'string')
    t.ok(peer1.remoteFamily.indexOf('IPv') === 0)
    t.ok(typeof peer2.remoteFamily === 'string')
    t.ok(peer2.remoteFamily.indexOf('IPv') === 0)

    peer1.send('sup peer2')
    peer2.on('data', data => {
      t.equal(data, 'sup peer2', 'got correct message')

      peer2.send('sup peer1')
      peer1.on('data', data => {
        t.equal(data, 'sup peer1', 'got correct message')

        function tryDone () {
          if (!peer1.connected && !peer2.connected) {
            t.pass('both peers closed')
            t.end()
          }
        }

        peer1.destroy(tryDone)
        peer2.destroy(tryDone)
      })
    })
  }
})

test('sdpTransform function is called', t => {
  var peer1 = new Peer({ initiator: true, wrtc: wrtc })
  var peer2 = new Peer({ wrtc: wrtc, sdpTransform: sdpTransform })

  function sdpTransform (sdp) {
    t.equal(typeof sdp, 'string', 'got a string as SDP')
    setTimeout(() => {
      peer1.destroy()
      peer2.destroy()
      t.end()
    })
    return sdp
  }

  peer1.on('signal', data => {
    peer2.signal(data)
  })

  peer2.on('signal', data => {
    peer1.signal(data)
  })
})

test('cleanup electron-eval daemon', t => {
  wrtc.electronDaemon.close()
  t.end()
})
