# Orianna
Another DHT crawler written in Node.js

## Install

```bash
npm install orianna
```

## Usage
```javascript
const orianna = new (require('orianna'))

orianna.onHandleGetPeers((hash, addr) => {
  console.log(`Receive get peers message from DHT ${addr.address}:${addr.port} Infohash: ${hash}`)
})

orianna.onHandleAnnouncePeer((hash, addr, peerAddr) => {
  console.log(`Receive announce peer message from DHT ${addr.address}:${addr.port} Infohash: ${hash} Peer address: ${peerAddr.address}:${peerAddr.port}`)
})

orianna.run(6881)
```

## Thanks
- [maga](https://github.com/whtsky/maga)
- [DHT Walkthrough Notes](https://gist.github.com/gubatron/cd9cfa66839e18e49846)
