'use strict'

var electron = require('electron-prebuilt')
var spawn = require('child_process').spawn
var json = require('newline-json')
var path = require('path')

var daemonMain = path.join(path.dirname(__dirname), 'daemon.js')

module.exports = class Daemon {
  constructor (opts) {
    opts = opts || {}
    opts.timeout = typeof opts.timeout === 'number' ? opts.timeout : 4000
    this.child = spawn(electron, [ daemonMain ])
    this.stdout = this.child.stdout.pipe(json.Parser())
    this.stdin = json.Stringifier()
    this.stdin.pipe(this.child.stdin)
    this.stdin.write(opts)
    this.keepaliveInterval = setInterval(this.keepalive.bind(this), opts.timeout / 2)
  }

  keepalive () {
    this.stdin.write(0)
  }

  close (signal) {
    this.child.kill(signal)
  }
}
