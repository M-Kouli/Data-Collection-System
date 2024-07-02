const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let latestData = '';

wss.on('connection', ws => {
  console.log('Client connected');
  ws.on('message', message => {
    console.log('Received: %s', message);
    latestData = message;
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/data', (req, res) => {
  res.send(latestData);
});

// Bind the server to 0.0.0.0 and port 8080
const PORT = 8080;
const HOST = '192.168.0.11';
server.listen(PORT, HOST, () => {
  console.log(`Server is listening on http://${HOST}:${PORT}`);
});
