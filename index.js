const dgram = require('dgram')
const inet_ntoa = require('./lib/inet_ntoa')

const RESPONSE_START = Buffer.from([ 0xFF, 0xFF, 0xFF, 0xFF, 0x66, 0x0A ])
const ZERO_IP = '0.0.0.0:0'

const formatFilters = (obj) => {
  let str = ''
  for (let key in obj) {
    str += '\\' + key + '\\' + obj[key]
  }
  str += '\x00'
  return str
}

const parse = function* (buf) {
  if (buf.compare(RESPONSE_START, 0, 6, 0, 6) === 0) {
    buf = buf.slice(6)
  }

  let i = 0
  while (i < buf.length) {
    const ip = inet_ntoa(buf.readInt32BE(i))
    const port = buf[i + 4] << 8 | buf[i + 5]
    yield ip + ':' + port
    i += 6
  }
}

// TODO: region as argument
const buildPacket = (seedIp, filters) =>
  Buffer.concat([
    Buffer.from([ 0x31 ]),
    Buffer.from([ 0xFF ]), // REGION
    Buffer.from(seedIp, 'ascii'), Buffer.from([ 0x00 ]),
    Buffer.from(formatFilters(filters || {}), 'ascii'),
  ])

const Readable = require('stream').Readable

class VMSQStream extends Readable {
  constructor(master, filters) {
    super({ encoding: 'utf8' })
    const [host, port] = master.split(':')
    this.masterHost = host
    this.masterPort = parseInt(port)
    this.filters = filters
    this.querying = false
    this.timeout = null

    const socket = this.socket = dgram.createSocket('udp4')

    socket.on('error', (err) => {
      this.emit('error', err)
      socket.close()
    })

    socket.on('message', (buf) => {
      clearTimeout(this.timeout)

      let last
      for (let ip of parse(buf)) {
        last = ip
        if (ip !== ZERO_IP) this.push(ip)
      }

      if (last !== ZERO_IP) {
        this.send(buildPacket(last, this.filters), () => {
          this.timeout = setTimeout(() => {
            this.emit('error', 'timeout: no response in a while')
            socket.close()
          }, 5000)
        })
      } else {
        socket.close()
        this.push(null)
        this.querying = false
      }
    })
  }

  send(msg, cb) {
    this.querying = true
    this.socket.send(msg, this.masterPort, this.masterHost, (err) => {
      if (err) {
        this.emit('error', err)
      } else {
        if (cb) cb()
      }
    })
  }

  _read() {
    if (this.querying === false) {
      this.send(buildPacket(ZERO_IP, this.filters))
      this.querying = true
    }
  }
}

module.exports = (master, filters) => new VMSQStream(master, filters)
