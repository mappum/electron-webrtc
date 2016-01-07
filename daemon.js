var json = require('newline-json')
var app = require('app')
var BrowserWindow = require('browser-window')
var path = require('path')
var ipc = require('ipc')

var stdout = json.Stringifier()
stdout.pipe(process.stdout)
var stdin = process.stdin.pipe(json.Parser())

var timeout
var options
var window

stdin.once('data', main)

function main (opts) {
  options = opts
  resetTimeout()

  stdin.on('data', function (message) {
    resetTimeout()
    if (!Array.isArray(message)) return
    window.webContents.send.apply(window.webContents, message)
  })

  ipc.on('data', function (e, data) {
    stdout.write(data)
  })

  app.on('ready', function () {
    window = new BrowserWindow({ show: false })
    window.loadUrl('file://' + path.join(__dirname, 'index.html'))
    window.webContents.on('did-finish-load', function () {
      stdout.write('ready')
    })
  })
}

function resetTimeout () {
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(function () { process.exit(0) }, options.timeout)
}
