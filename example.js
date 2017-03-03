const vmsq = require('.')

const stream = vmsq('hl2master.steampowered.com:27011', vmsq.EUROPE, {
  gamedir: 'cstrike',
  map: 'de_nuke',
  empty: 1
})

const servers = []

stream.on('error', (err) => {
  console.error(err)
})

stream.on('data', (ip) => {
  console.log(ip)
  servers.push(ip)
})

stream.on('end', () => {
  console.log(`got ${servers.length} servers`)
})

process.on('SIGINT', function() {
  stream.socket.close()
})
