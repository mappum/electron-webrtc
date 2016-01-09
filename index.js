var electron = require('electron-eval')

module.exports = function (cb) {
  var daemon = electron()
  return {
    electronDaemon: daemon,
    RTCPeerConnection: require('./src/RTCPeerConnection.js')(daemon, cb),
    RTCSessionDescription: require('./src/RTCSessionDescription.js'),
    RTCIceCandidate: require('./src/RTCIceCandidate.js'),
    RTCDataChannel: require('./src/RTCDataChannel.js')
  }
}
