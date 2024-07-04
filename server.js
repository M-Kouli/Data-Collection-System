const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.static('public'));
app.use(express.json()); // For parsing application/json

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/OvenMonitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define Oven schema
const ovenSchema = new mongoose.Schema({
  name: String,
  category: String,
});

const Oven = mongoose.model('Ovens', ovenSchema);

let latestData = '';

wss.on('connection', ws => {
  console.log('Client connected');
  ws.on('message', async message => {
    console.log('Received: %s', message);
    latestData = message;

    // Parse the incoming message (assuming it's in JSON format)
    const parsedData = JSON.parse(message);

    // Here you can handle the data coming from WebSocket
    // For example, saving the data to the database (this would be a different collection)
    // const newData = new OvenData({
    //   ovenId: parsedData.ovenId,
    //   data: parsedData.data,
    //   timestamp: new Date(),
    // });
    // await newData.save();
  });
});

// Serve static files from the 'views' directory
app.use(express.static(path.join(__dirname, 'views')));

// Serve the index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/views/index.html'));
});

app.get('/devices', (req, res) => {
  res.sendFile(path.join(__dirname + '/views/devices.html'));
});

app.get('/data', (req, res) => {
  res.send(latestData);
});

// RESTful routes for managing ovens

// Get all ovens
app.get('/ovens', async (req, res) => {
  try {
    const ovens = await Oven.find();
    res.json(ovens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new oven
app.post('/ovens', async (req, res) => {
  const newOven = new Oven(req.body);
  try {
    await newOven.save();
    res.status(201).json(newOven);
    
    // Broadcast to all connected WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'newOven', data: newOven }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update an oven
app.put('/ovens/:id', async (req, res) => {
  try {
    const updatedOven = await Oven.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedOven) return res.status(404).json({ error: 'Oven not found' });
    res.json(updatedOven);
    
    // Broadcast update to all connected WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'updateOven', data: updatedOven }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete an oven
app.delete('/ovens/:id', async (req, res) => {
  try {
    const deletedOven = await Oven.findByIdAndDelete(req.params.id);
    if (!deletedOven) return res.status(404).json({ error: 'Oven not found' });
    res.json(deletedOven);
    
    // Broadcast delete to all connected WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'deleteOven', data: deletedOven }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bind the server to 0.0.0.0 and port 3000
const PORT = 3000;
const HOST = 'localhost';
server.listen(PORT, HOST, () => {
  console.log(`Server is listening on http://${HOST}:${PORT}`);
});
