const dgram = require('dgram')
const inet_ntoa = require('./lib/inet_ntoa')

const RESPONSE_START = Buffer.from([ 0xFF, 0xFF, 0xFF, 0xFF, 0x66, 0x0A ])
const ZERO_IP = '0.0.0.0:0'

const REGIONS = {
  US_EAST_COAST : 0x00,
  US_WEST_COAST : 0x01,
  SOUTH_AMERICA : 0x02,
  EUROPE        : 0x03,
  ASIA          : 0x04,
  AUSTRALIA     : 0x05,
  MIDDLE_EAST   : 0x06,
  AFRICA        : 0x07,
  ALL           : 0xFF
}

const slashify = (obj) => {
  let str = ''
  for (let key in obj) {
    let val = obj[key]
    str += '\\' + key + '\\' + val
  }
  return str
}

const formatFilters = (obj) => {
  let str = ''
  for (let key in obj) {
    let val = obj[key]
    str += '\\' + key + '\\'
    str += (key === 'nor' || key === 'nand')
      ? Object.keys(val).length + slashify(val)
      : val
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

const buildPacket = (seedIp, region, filters) =>
  Buffer.concat([
    Buffer.from([ 0x31 ]),
    Buffer.from([ region ]),
    Buffer.from(seedIp, 'ascii'), Buffer.from([ 0x00 ]),
    Buffer.from(formatFilters(filters), 'ascii'),
  ])

const Readable = require('stream').Readable

class VMSQStream extends Readable {
  constructor(master, region, filters) {
    super({ encoding: 'utf8' })
    const [host, port] = master.split(':')
    this.masterHost = host
    this.masterPort = parseInt(port)
    this.region = region
    this.filters = filters || {}
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
        this.send(buildPacket(last, this.region, this.filters), () => {
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
      this.send(buildPacket(ZERO_IP, this.region, this.filters))
      this.querying = true
    }
  }
}

module.exports = (...args) =>
  new VMSQStream(...args)

for (let key in REGIONS) {
  module.exports[key] = REGIONS[key]
}
