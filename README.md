# vmsq [![npm version](https://badge.fury.io/js/vmsq.svg)](http://badge.fury.io/js/vmsq)

query valve's master servers

```sh
$ npm install vmsq
```

## usage

#### `vmsq(masterServer :: String, filters? :: Object) → Stream`

- `masterServer`: The master server to query, e.g.  'hl2master.steampowered.com:27011'
- `filters`: Optional object that contains [filters](https://developer.valvesoftware.com/wiki/Master_Server_Query_Protocol#Filter) sent with query

Returns a ReadableStream that emits each server as a string one by one.

## example

```js
const vmsq = require('vmsq')

const stream = vmsq('hl2master.steampowered.com:27011', {
  gamedir: 'cstrike',
  map: 'de_nuke'
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
```

### output

```
88.241.39.16:27015
178.150.208.1:40000
...
got 24 servers
```
