'use strict'

module.exports = class RTCIceCandidate {
  constructor (obj) {
    this.candidate = obj.candidate
    this.sdpMid = obj.sdpMid
    this.sdpMLineIndex = obj.sdpMLineIndex
  }
}
