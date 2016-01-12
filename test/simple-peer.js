var test = require('tape')
var Peer = require('simple-peer')
var str = require('string-to-stream')

var wrtc
test('create daemon', t => {
  wrtc = require('..')()
  wrtc.electronDaemon.once('ready', t.end)
})

// test/basic.js

test('signal event gets emitted', function (t) {
  var peer = new Peer({ wrtc, initiator: true })
  peer.once('signal', function () {
    t.pass('got signal event')
    peer.destroy()
    t.end()
  })
})

test('data send/receive text', function (t) {
  var peer1 = new Peer({ wrtc, initiator: true })
  var peer2 = new Peer({ wrtc })

  var numSignal1 = 0
  peer1.on('signal', function (data) {
    numSignal1 += 1
    peer2.signal(data)
  })

  var numSignal2 = 0
  peer2.on('signal', function (data) {
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
    peer2.on('data', function (data) {
      t.equal(data, 'sup peer2', 'got correct message')

      peer2.send('sup peer1')
      peer1.on('data', function (data) {
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

test('sdpTransform function is called', function (t) {
  var peer1 = new Peer({ wrtc, initiator: true })
  var peer2 = new Peer({ wrtc, sdpTransform: sdpTransform })

  function sdpTransform (sdp) {
    t.equal(typeof sdp, 'string', 'got a string as SDP')
    setTimeout(function () {
      peer1.destroy()
      peer2.destroy()
      t.end()
    })
    return sdp
  }

  peer1.on('signal', function (data) {
    peer2.signal(data)
  })

  peer2.on('signal', function (data) {
    peer1.signal(data)
  })
})

// test/binary.js

test('data send/receive ArrayBuffer', function (t) {
  var peer1 = new Peer({ wrtc, initiator: true })
  var peer2 = new Peer({ wrtc })
  peer1.on('signal', function (data) {
    peer2.signal(data)
  })
  peer2.on('signal', function (data) {
    peer1.signal(data)
  })
  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest () {
    if (!peer1.connected || !peer2.connected) return

    peer1.send(new Uint8Array([1, 2, 3]).buffer)
    peer2.on('data', function (data) {
      t.ok(Buffer.isBuffer(data), 'data is Buffer')
      t.deepEqual(data, new Buffer([1, 2, 3]), 'got correct message')

      peer2.send(new Uint8Array([2, 3, 4]).buffer)
      peer1.on('data', function (data) {
        t.ok(Buffer.isBuffer(data), 'data is Buffer')
        t.deepEqual(data, new Buffer([2, 3, 4]), 'got correct message')

        peer1.destroy(tryDone)
        peer2.destroy(tryDone)

        function tryDone () {
          if (!peer1.connected && !peer2.connected) {
            t.pass('both peers closed')
            t.end()
          }
        }
      })
    })
  }
})

// test/stream.js

test('duplex stream: send data before "connect" event', function (t) {
  t.plan(9)

  var peer1 = new Peer({ wrtc, initiator: true })
  var peer2 = new Peer({ wrtc })
  peer1.on('signal', function (data) { if (!peer2.destroyed) peer2.signal(data) })
  peer2.on('signal', function (data) { if (!peer1.destroyed) peer1.signal(data) })

  str('abc').pipe(peer1)

  peer1.on('data', function () {
    t.fail('peer1 should not get data')
  })
  peer1.on('finish', function () {
    t.pass('got peer1 "finish"')
    t.ok(peer1._writableState.finished)
  })
  peer1.on('end', function () {
    t.pass('got peer1 "end"')
    t.ok(peer1._readableState.ended)
  })

  peer2.on('data', function (chunk) {
    t.equal(chunk.toString(), 'abc', 'got correct message')
  })
  peer2.on('finish', function () {
    t.pass('got peer2 "finish"')
    t.ok(peer2._writableState.finished)
  })
  peer2.on('end', function () {
    t.pass('got peer2 "end"')
    t.ok(peer2._readableState.ended)
  })
})

test('duplex stream: send data one-way', function (t) {
  t.plan(9)

  var peer1 = new Peer({ wrtc, initiator: true })
  var peer2 = new Peer({ wrtc })
  peer1.on('signal', function (data) { peer2.signal(data) })
  peer2.on('signal', function (data) { peer1.signal(data) })
  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest () {
    if (!peer1.connected || !peer2.connected) return

    peer1.on('data', function () {
      t.fail('peer1 should not get data')
    })
    peer1.on('finish', function () {
      t.pass('got peer1 "finish"')
      t.ok(peer1._writableState.finished)
    })
    peer1.on('end', function () {
      t.pass('got peer1 "end"')
      t.ok(peer1._readableState.ended)
    })

    peer2.on('data', function (chunk) {
      t.equal(chunk.toString(), 'abc', 'got correct message')
    })
    peer2.on('finish', function () {
      t.pass('got peer2 "finish"')
      t.ok(peer2._writableState.finished)
    })
    peer2.on('end', function () {
      t.pass('got peer2 "end"')
      t.ok(peer2._readableState.ended)
    })

    str('abc').pipe(peer1)
  }
})

// test/trickle.js

test.skip('disable trickle', function (t) {
  var peer1 = new Peer({ wrtc, initiator: true, trickle: false })
  var peer2 = new Peer({ wrtc, trickle: false })

  var numSignal1 = 0
  peer1.on('signal', function (data) {
    console.log('signal1 ' + new Array(40).join('#'))
    numSignal1 += 1
    peer2.signal(data)
  })

  var numSignal2 = 0
  peer2.on('signal', function (data) {
    console.log('signal2 ' + new Array(40).join('#'))
    numSignal2 += 1
    peer1.signal(data)
  })

  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest () {
    if (!peer1.connected || !peer2.connected) return

    t.equal(numSignal1, 1, 'only one `signal` event')
    t.equal(numSignal2, 1, 'only one `signal` event')
    t.equal(peer1.initiator, true, 'peer1 is initiator')
    t.equal(peer2.initiator, false, 'peer2 is not initiator')

    peer1.send('sup peer2')
    peer2.on('data', function (data) {
      t.equal(data, 'sup peer2', 'got correct message')

      peer2.send('sup peer1')
      peer1.on('data', function (data) {
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

test('disable trickle (only initiator)', function (t) {
  var peer1 = new Peer({ wrtc, initiator: true, trickle: false })
  var peer2 = new Peer({ wrtc })

  var numSignal1 = 0
  peer1.on('signal', function (data) {
    numSignal1 += 1
    peer2.signal(data)
  })

  var numSignal2 = 0
  peer2.on('signal', function (data) {
    numSignal2 += 1
    peer1.signal(data)
  })

  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest () {
    if (!peer1.connected || !peer2.connected) return

    t.equal(numSignal1, 1, 'only one `signal` event for initiator')
    t.ok(numSignal2 >= 1, 'at least one `signal` event for receiver')
    t.equal(peer1.initiator, true, 'peer1 is initiator')
    t.equal(peer2.initiator, false, 'peer2 is not initiator')

    peer1.send('sup peer2')
    peer2.on('data', function (data) {
      t.equal(data, 'sup peer2', 'got correct message')

      peer2.send('sup peer1')
      peer1.on('data', function (data) {
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

test('disable trickle (only receiver)', function (t) {
  var peer1 = new Peer({ wrtc, initiator: true })
  var peer2 = new Peer({ wrtc, trickle: false })

  var numSignal1 = 0
  peer1.on('signal', function (data) {
    numSignal1 += 1
    peer2.signal(data)
  })

  var numSignal2 = 0
  peer2.on('signal', function (data) {
    numSignal2 += 1
    peer1.signal(data)
  })

  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest () {
    if (!peer1.connected || !peer2.connected) return

    t.ok(numSignal1 >= 1, 'at least one `signal` event for initiator')
    t.equal(numSignal2, 1, 'only one `signal` event for receiver')
    t.equal(peer1.initiator, true, 'peer1 is initiator')
    t.equal(peer2.initiator, false, 'peer2 is not initiator')

    peer1.send('sup peer2')
    peer2.on('data', function (data) {
      t.equal(data, 'sup peer2', 'got correct message')

      peer2.send('sup peer1')
      peer1.on('data', function (data) {
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

// cleanup

test('cleanup electron-eval daemon', t => {
  wrtc.electronDaemon.close()
  t.end()
})
