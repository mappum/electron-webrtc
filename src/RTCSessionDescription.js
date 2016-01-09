'use strict'

module.exports = class RTCSessionDescription {
  constructor (obj) {
    this.type = obj.type
    this.sdp = obj.sdp
  }

  toJSON () { return this }
}
