const bencode = require('bencode')
const crypto = require('crypto')
const dgram = require('dgram')
const EventEmitter = require('events')

const BOOTSTRAP_NODES = [
  {address: 'router.bittorrent.com', port: 6881},
  {address: 'dht.transmissionbt.com', port: 6881},
  {address: 'router.utorrent.com', port: 6881},
]

class Orianna extends EventEmitter {
  constructor(bootstrapNodes = BOOTSTRAP_NODES, interval = 3000) {
    super()
    this.nodeId = this.randomNodeId()
    this.bootstrapNodes = bootstrapNodes
    this.interval = interval
    this.transport = dgram.createSocket('udp4')
  }

  randomNodeId(size = 20) {
    return crypto.randomBytes(size)
  }

  properInfohash(infoHash) {
    return infoHash.toString('hex').toUpperCase()
  }

  splitNodes(data) {
    const nodes = []
    const length = data.length
    if (length % 26 !== 0) {
      return nodes
    }

    for (let i = 0; i + 26 <= data.length; i += 26) {
      nodes.push({
        address: `${data[i + 20]}.${data[i + 21]}.${data[i + 22]}.${data[i + 23]}`,
        port: data.readUInt16BE(i + 24)

      });
    }

    return nodes;
  }

  datagramReceived(data, addr) {
    try {
      const msg = bencode.decode(data)
      this.handleMessage(msg, addr)
    } catch (e) {
      // console.log(e)
    }
  }

  sendMessage(data, addr) {
    const dataEncoded = bencode.encode(data)
    this.transport.send(dataEncoded, 0, dataEncoded.length, addr.port, addr.address)
  }

  handleMessage(msg, addr) {
    const msg_type = (msg.y || 'e').toString()
    switch (msg_type) {
      case 'r':
        this.handleResponse(msg, addr)
        break
      case 'q':
        this.handleQuery(msg, addr)
        break
    }
  }

  handleResponse(msg, addr) {
    if (msg.r.nodes) {
      const nodes = this.splitNodes(msg.r.nodes)
      nodes.forEach(addr => this.ping(addr))
    }
  }

  handleQuery(msg, addr) {
    const {t: tId, q: queryType, a: {id: nodeId, info_hash: infoHash, port: peerPort}} = msg
    switch (queryType.toString()) {
      case 'get_peers':
        const token = infoHash.slice(2)
        this.sendMessage({
          "t": tId,
          "y": "r",
          "r": {
            "id": this.fakeNodeId(nodeId),
            "nodes": "",
            "token": token
          }
        }, addr)
        this.emit('get_peers', this.properInfohash(infoHash), addr)
        break
      case 'announce_peer':
        this.sendMessage({
          "t": tId,
          "y": "r",
          "r": {
            "id": this.fakeNodeId(nodeId),
          }
        }, addr)
        const peerAddr = {
          address: addr.address,
          port: peerPort || addr.port
        }
        this.emit('announce_peer', this.properInfohash(infoHash), addr, peerAddr)
        break
      case 'find_node':
        this.sendMessage({
          "t": tId,
          "y": "r",
          "r": {
            "id": this.fakeNodeId(nodeId),
            "nodes": ""
          }
        }, addr)
        break
      case 'ping':
        this.sendMessage({
          "t": "tt",
          "y": "r",
          "r": {
            "id": this.fakeNodeId(nodeId)
          }
        }, addr)
        break
    }
    this.findNode(addr, nodeId)
  }

  ping(addr, nodeId = null) {
    this.sendMessage({
      "y": "q",
      "t": "pg",
      "q": "ping",
      "a": {
        "id": this.fakeNodeId(nodeId)
      }
    }, addr)
  }

  fakeNodeId(nodeId = null) {
    if (nodeId) {
      return Buffer.concat([nodeId.slice(0, -1), this.nodeId.slice(-1)])
    }
    return this.nodeId
  }


  findNode(addr, nodeId = null, target = null) {
    if (!target) {
      target = this.randomNodeId()
    }
    this.sendMessage({
      "t": "fn",
      "y": "q",
      "q": "find_node",
      "a": {
        "id": this.fakeNodeId(nodeId),
        "target": target
      }
    }, addr)
  }

  autoFindNodes() {
    this.bootstrapNodes.forEach(addr => this.findNode(addr, this.nodeId))
  }

  run(port = 6881) {
    this.transport.bind(port)
    this.transport.on('listening', () => {
      const address = this.transport.address();
      console.log(`server listening ${address.address}:${address.port}`);
    });

    this.transport.on('message', (msg, addr) => {
      this.datagramReceived(msg, addr)
    })

    this.transport.on('error', (err) => {
      // console.log(`server error:\n${err.stack}`);
    });

    this.autoFindNodes()
    setInterval(() => {
      try {
        this.autoFindNodes()
      } catch (e) {
        // console.log(e)
      }

    }, this.interval)
  }

  onHandleGetPeers(handle) {
    this.on('get_peers', (infoHash, addr) => handle(infoHash, addr))
  }

  onHandleAnnouncePeer(handle) {
    this.on('announce_peer', (infoHash, addr, peerAddr) => handle(infoHash, addr, peerAddr))
  }
}

module.exports = Orianna
