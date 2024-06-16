const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = 5000;

// Global variables to store the latest data from the serial ports
let latestDataCom1 = '';
let latestDataCom2 = '';

// Function to read from serial port
const readFromSerial = (serialPort, storageVariable, ws) => {
  const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
  parser.on('data', (line) => {
    console.log(`Received from ${serialPort.path}: ${line.trim()}`);
    if (storageVariable === 'com1') {
      latestDataCom1 = line.trim();
    } else if (storageVariable === 'com2') {
      latestDataCom2 = line.trim();
    }
    
    // Broadcast the new data to all connected clients
    ws.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          port: storageVariable,
          data: line.trim()
        }));
      }
    });
  });

  serialPort.on('error', (err) => {
    console.error(`Error on ${serialPort.path}:`, err.message);
  });
};

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Define routes for initial data fetch
app.get('/data/com1', (req, res) => {
  res.json({ data: latestDataCom1 });
});

app.get('/data/com2', (req, res) => {
  res.json({ data: latestDataCom2 });
});

// Serial port settings
const com1Port = new SerialPort({ path: 'COM2', baudRate: 9600 });
const com2Port = new SerialPort({ path: 'COM4', baudRate: 9600 });

// Create WebSocket server
const server = app.listen(port, () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected');

  // Send the initial data to the new client
  ws.send(JSON.stringify({ port: 'com1', data: latestDataCom1 }));
  ws.send(JSON.stringify({ port: 'com2', data: latestDataCom2 }));

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start reading from serial ports
readFromSerial(com1Port, 'com1', wss);
readFromSerial(com2Port, 'com2', wss);
