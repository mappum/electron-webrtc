'use strict'

var EventEmitter = require('events').EventEmitter

module.exports = function (daemon) {
  return class RTCDataChannel extends EventEmitter {
    constructor (pcId, label, opts) {
      super()
      if (typeof pcId === 'object') {
        // wrap existing remote RTCDataChannel
        this._wrap(pcId)
      } else {
        // create new remote RTCDataChannel
        this._create(pcId, label, opts)
      }
    }

    _create (pcId, label, opts) {
      opts = opts || {}
      this._pcId = pcId
      this.label = label
      this.ordered = null
      this.protocol = ''
      this.id = this.stream = null
      this.readyState = 'connecting'
      this.bufferedAmount = 0
      this._bufferedAmountLowThreshold = 0
      this._binaryType = 'blob'
      this.maxPacketLifeType = null
      this.maxRetransmits = null
      this.negotiated = false
      this.reliable = typeof opts.reliable === 'boolean' ? opts.reliable : true

      daemon.eval(`
        var pc = conns[${JSON.stringify(pcId)}]
        var dc = pc.createDataChannel(
          ${JSON.stringify(label)}, ${JSON.stringify(opts)})
        pc.dataChannels[dc.id] = dc
        dc.id
      `, (err, id) => {
        if (err) this.emit('error', err)
        this.id = this.stream = id
        this._registerListeners()
        this.emit('init')
      })
    }

    _wrap (init) {
      for (let k in init) {
        this[k] = init[k]
      }
      this.stream = this.id
      this._registerListeners()
    }

    _registerListeners (cb) {
      daemon.on(`dc:${this._pcId}:${this.id}`, this.onMessage.bind(this))
      this._eval(`
        var id = 'dc:' + ${this._pcId} + ':' + dc.id
        dc.onopen = function () {
          send(id, {
            type: 'open',
            state: {
              ordered: dc.ordered,
              protocol: dc.protocol,
              maxPacketLifeType: dc.maxPacketLifeType,
              maxRetransmits: dc.maxRetransmits,
              negotiated: dc.negotiated,
              reliable: dc.reliable
            }
          })
        }
        dc.onmessage = function (e) {
          send(id, {
            type: 'message',
            event: {
              data: e.data,
              origin: e.origin
            }
          })
        }
        dc.onbufferedamountlow = function () {
          send(id, { type: 'bufferedamountlow' })
        }
        dc.onclose = function () {
          delete pc.dataChannels[dc.id]
          send(id, { type: 'close' })
        }
        dc.onerror = function () {
          send(id, { type: 'error' })
        }
        if (dc.readyState === 'open') dc.onopen()
      `, cb || (err => {
        if (err) return this.emit('error', err)
      }))
    }

    onMessage (message) {
      var handler = this['on' + message.type]
      var event = message.event || {}

      // console.log('dc<<', this.id, message.type, message, !!handler)

      // TODO: create classes for different event types?

      switch (message.type) {
        case 'open':
          this.readyState = 'open'
          break

        case 'close':
          this.readyState = 'closed'
          break
      }

      if (handler) handler(event)
    }

    close () {
      this.readyState = 'closing'
      this._eval('if (dc) dc.close()', err => {
        if (err) this.emit('error', err)
      })
    }

    send (data) {
      // TODO: convert type of data
      this._eval(`
        dc.send(${JSON.stringify(data)})
        dc.bufferedAmount
      `, (err, bufferedAmount) => {
        if (err) return this.emit('error', err)
        this.bufferedAmount = bufferedAmount
      })
    }

    _eval (code, cb) {
      return daemon.eval(`
        var pc = conns[${JSON.stringify(this._pcId)}]
        var dc = pc.dataChannels[${JSON.stringify(this.id)}]
      ` + code, cb || (err => {
        if (err) this.emit('error', err)
      }))
    }

    _setProp (name, value) {
      if (this.id == null) {
        return this.once('init', () => this._setProp(name, value))
      }
      return this._eval(`dc["${name}"] = ${JSON.stringify(value)}`)
    }

    get bufferedAmountLowThreshold () {
      return this._bufferedAmountLowThreshold
    }
    set bufferedAmountLowThreshold (value) {
      this._bufferedAmountLowThreshold = value
      this._setProp('bufferedAmountLowThreshold', value)
    }

    get binaryType () {
      return this._binaryType
    }
    set binaryType (value) {
      this._binaryType = value
      this._setProp('binaryType', value)
    }
  }
}
