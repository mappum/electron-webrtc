'use strict'

var EventEmitter = require('events').EventEmitter

module.exports = function (daemon) {
  daemon.eval('window.dataChannels = {}', err => {
    if (err) daemon.emit('error', err)
  })

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
      this.label = label
      this.ordered = null
      this.protocol = ''
      this.id = this.stream = null
      this.readyState = 'connecting'
      this.bufferedAmount = 0
      this.bufferedAmountLowThreshold = 0 // TODO: use a getter/setter
      this.binaryType = 'blob' // TODO: use a getter/setter
      this.maxPacketLifeType = null
      this.maxRetransmits = null
      this.negotiated = false
      this.reliable = typeof opts.reliable === 'boolean' ? opts.reliable : true

      daemon.eval(`
        var dc = conns[${pcId}].createDataChannel(
          ${JSON.stringify(label)}, ${JSON.stringify(opts)})
        dataChannels[dc.id] = dc
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
      daemon.on(`dc:${this.id}`, this.onMessage.bind(this))
      daemon.eval(`
        var dc = dataChannels[${this.id}]
        dc.onopen = function () {
          send('dc:' + dc.id, {
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
          send('dc:' + dc.id, {
            type: 'message',
            event: {
              data: e.data,
              origin: e.origin
            }
          })
        }
        dc.onbufferedamountlow = function () {
          send('dc:' + dc.id, { type: 'bufferedamountlow' })
        }
        dc.onclose = function () {
          delete dataChannels[dc.id]
          send('dc:' + dc.id, { type: 'close' })
        }
        dc.onerror = function () {
          send('dc:' + dc.id, { type: 'error' })
        }
        if (dc.readyState === 'open') dc.onopen()
      `, cb || (err => {
        if (err) return this.error('error', err)
      }))
    }

    onMessage (message) {
      var handler = this['on' + message.type]
      var event = message.event || {}

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
      daemon.eval(`
        var dc = dataChannels[${JSON.stringify(this.id)}]
        if (dc) dc.close()
      `, err => {
        if (err) this.emit('error', err)
      })
    }

    send (data) {
      // TODO: convert type of data
      daemon.eval(`
        var dc = dataChannels[${JSON.stringify(this.id)}]
        dc.send(${JSON.stringify(data)})
        dc.bufferedAmount
      `, (err, bufferedAmount) => {
        if (err) return this.emit('error', err)
        this.bufferedAmount = bufferedAmount
      })
    }
  }
}
