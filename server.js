const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = 5000;

// Global variable to store the latest data from the Python script
let latestDataCom6 = '';

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Define route for initial data fetch
app.get('/data/com6', (req, res) => {
  res.json({ data: latestDataCom6 });
});

// Create WebSocket server
const server = app.listen(port, () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected');

  // Send the initial data to the new client
  ws.send(JSON.stringify({ port: 'com6', data: latestDataCom6 }));

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Handle data received from Python script
const pythonWsServer = new WebSocket.Server({ port: 5001 });

pythonWsServer.on('connection', pythonWs => {
  console.log('Python script connected');

  pythonWs.on('message', message => {
    const data = JSON.parse(message);
    if (data.port === 'com6') {
      latestDataCom6 = data.data;
      console.log(`Received from COM6: ${latestDataCom6}`);

      // Broadcast the new data to all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            port: 'com6',
            data: latestDataCom6
          }));
        }
      });
    }
  });

  pythonWs.on('close', () => {
    console.log('Python script disconnected');
  });
});
