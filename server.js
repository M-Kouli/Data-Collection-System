const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
let latestData = '';

wss.on('connection', ws => {
  console.log('Client connected');
  ws.on('message', message => {
    console.log('Received: %s', message);
    latestData = message;
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname +'/views/index.html'));
});

app.get('/devices', (req, res) => {
  res.sendFile(path.join(__dirname +'/views/devices.html'));
});
app.get('/data', (req, res) => {
  res.send(latestData);
});

// Bind the server to 0.0.0.0 and port 8080
const PORT = 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server is listening on http://${HOST}:${PORT}`);
});
