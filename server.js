const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mongoose = require('mongoose');
const OvenData = require('./models/OvenData'); // Import the OvenData model

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
db.once('open', async () => {
  console.log('Connected to MongoDB');
  await createOvenCollections(); // Ensure collections are created
});

// Define Oven schema
const ovenSchema = new mongoose.Schema({
  name: String,
  category: String,
});

const Oven = mongoose.model('Ovens', ovenSchema);

// Function to create collections for each oven
async function createOvenCollections() {
  const ovens = await Oven.find();
  const collectionNames = await mongoose.connection.db.listCollections().toArray();
  const existingCollections = collectionNames.map(col => col.name);

  for (const oven of ovens) {
    const collectionName = oven.name;

    if (!existingCollections.includes(collectionName)) {
      console.log(`Creating collection for ${collectionName}`);
      await mongoose.connection.createCollection(collectionName);
    } else {
      console.log(`Collection for ${collectionName} already exists`);
    }
  }
}

function formatTimestampLong(timestamp) {
  const date = new Date(timestamp);
  const options = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  return date.toLocaleString('en-US', options);
}

// Server-side WebSocket handling
wss.on('connection', ws => {
  console.log('Client connected');
  ws.on('message', async message => {
    console.log('Received: %s', message);

    // Parse the incoming message (assuming it's in JSON format)
    const parsedData = JSON.parse(message);

    // Format the timestamp before saving
    const formattedTimestamp = parsedData.data.timestamp ? formatTimestampLong(parsedData.data.timestamp) : formatTimestampLong(new Date());

    // Save the data to the database
    const newData = new OvenData({
      ovenId: parsedData.data.ovenId,
      temperature: parsedData.data.temperature,
      temperatureUpperControlLimit: parsedData.data.upperControlLimit,
      temperatureLowerControlLimit: parsedData.data.lowerControlLimit,
      p1: parsedData.data.p1,
      p1UpperControlLimit: parsedData.data.p1UpperControlLimit,
      p1LowerControlLimit: parsedData.data.p1LowerControlLimit,
      p2: parsedData.data.p2,
      p2UpperControlLimit: parsedData.data.p2UpperControlLimit,
      p2LowerControlLimit: parsedData.data.p2LowerControlLimit,
      t1: parsedData.data.t1,
      t1UpperControlLimit: parsedData.data.t1UpperControlLimit,
      t1LowerControlLimit: parsedData.data.t1LowerControlLimit,
      t2: parsedData.data.t2,
      t2UpperControlLimit: parsedData.data.t2UpperControlLimit,
      t2LowerControlLimit: parsedData.data.t2LowerControlLimit,
      vx: parsedData.data.vx,
      vxUpperControlLimit: parsedData.data.vxUpperControlLimit,
      vxLowerControlLimit: parsedData.data.vxLowerControlLimit,
      vz: parsedData.data.vz,
      vzUpperControlLimit: parsedData.data.vzUpperControlLimit,
      vzLowerControlLimit: parsedData.data.vzLowerControlLimit,
      ct: parsedData.data.ct,
      ctUpperControlLimit: parsedData.data.ctUpperControlLimit,
      ctLowerControlLimit: parsedData.data.ctLowerControlLimit,
      vt: parsedData.data.vt,
      vtUpperControlLimit: parsedData.data.vtUpperControlLimit,
      vtLowerControlLimit: parsedData.data.vtLowerControlLimit,
      dataType: parsedData.data.dataType,
      boardId: parsedData.data.boardId,
      timestamp: formattedTimestamp
    });

    try {
      await newData.save();
      // Broadcast to all connected WebSocket clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          console.log('Broadcasting message to client:', JSON.stringify({ type: 'newOvenData', data: newData }));
          client.send(JSON.stringify({ type: 'newOvenData', data: newData }));
        }
      });
    } catch (err) {
      console.error('Error saving data:', err.message);
    }
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
  res.send('WebSocket server running');
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

// Add oven data
app.post('/ovenData', async (req, res) => {
  const formattedTimestamp = req.body.timestamp ? formatTimestampLong(req.body.timestamp) : formatTimestampLong(new Date());
  const newOvenData = new OvenData({ ...req.body, timestamp: formattedTimestamp });
  try {
    await newOvenData.save();
    res.status(201).json(newOvenData);
    
    // Broadcast to all connected WebSocket clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'newOvenData', data: newOvenData }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get Temp for a specific oven
app.get('/ovenTemp/:ovenId', async (req, res) => {
  try {
    let filter = { ovenId: req.params.ovenId };
    const ovenData = await OvenData.find(filter);
    res.json(ovenData.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get data for a specific oven with type and option
app.get('/ovenData/:ovenId', async (req, res) => {
  const { type, option, boardNum } = req.query;
  try {
    let filter = { ovenId: req.params.ovenId };
    if (type === 'Board' && option) {
      filter.boardId = boardNum; // Assuming board data is identified by boardId
    }
    const ovenData = await OvenData.find(filter);
    res.json(ovenData.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bind the server to 0.0.0.0 and port 3000
const PORT = 3000;
const HOST = 'localhost';
server.listen(PORT, HOST, () => {
  console.log(`Server is listening on http://${HOST}:${PORT}`);
});
