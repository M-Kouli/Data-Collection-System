const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mongoose = require('mongoose');
const OvenData = require('./models/OvenData');
const OvenStatus = require('./models/OvenStatus');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.static('public'));
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/OvenMonitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');
  await createOvenCollections();
});

// Define Oven schema
const ovenSchema = new mongoose.Schema({
  name: String,
  category: String,
}, { collection: 'ovens' }); // Explicitly set the collection name

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
      const ovenDataSchema = new mongoose.Schema({
        ovenId: { type: String, required: true },
        timestamp: { type: String, required: true },
        temperature: { type: Number, required: true },
        temperatureUpperControlLimit: { type: Number, required: true },
        temperatureLowerControlLimit: { type: Number, required: true },
        dataType: { type: String, enum: ['Oven', 'Board'], required: true },
        boardId: { type: String, required: function () { return this.dataType === 'Board'; } },
        p1: { type: Number, required: function () { return this.dataType === 'Board'; } },
        p1UpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        p1LowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        p2: { type: Number, required: function () { return this.dataType === 'Board'; } },
        p2UpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        p2LowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        t1: { type: Number, required: function () { return this.dataType === 'Board'; } },
        t1UpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        t1LowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        t2: { type: Number, required: function () { return this.dataType === 'Board'; } },
        t2UpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        t2LowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vx: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vxUpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vxLowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vz: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vzUpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vzLowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        ct: { type: Number, required: function () { return this.dataType === 'Board'; } },
        ctUpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        ctLowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vt: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vtUpperControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
        vtLowerControlLimit: { type: Number, required: function () { return this.dataType === 'Board'; } },
      }, { collection: collectionName });
      ovenDataSchema.add({ activeID: { type: Number, required: true } });
      const OvenDataCollection = mongoose.model(collectionName, ovenDataSchema);
      await mongoose.connection.createCollection(collectionName);
      await OvenDataCollection.createIndexes();
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

async function getLatestActiveID(collection) {
  const latestEntry = await collection.findOne({}, { sort: { activeID: -1 } });
  return latestEntry ? latestEntry.activeID : 0;
}
const activeOvens = new Map();

function registerSchemaIfNeeded(ovenName) {
  if (!mongoose.modelNames().includes(ovenName)) {
    const ovenDataSchema = OvenData.schema.clone();
    ovenDataSchema.add({ activeID: { type: Number, required: true } });
    mongoose.model(ovenName, ovenDataSchema);
  }
}

// Server-side WebSocket handling
wss.on('connection', (ws) => {
  let clientId;
  console.log('Client connected');
  ws.on('message', async message => {
    console.log('Received: %s', message);

    const parsedData = JSON.parse(message);
    if (parsedData.type === 'identify') {
      clientId = parsedData.clientId;
      console.log(`Client identified: ${clientId}`);
      await OvenStatus.findOneAndUpdate(
        { ovenName: clientId },
        { status: 'Idle', timestamp: new Date().toISOString() },
        { upsert: true }
      );
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'statusUpdate', data: { ovenName: clientId, status: 'Idle', timestamp: new Date().toISOString() } }));
        }
      });
    } else if (parsedData.type === 'ovenActive') {
      const ovenName = parsedData.data.ovenId;

      // Use the existing collection without creating a new model
      const activeOvenCollection = mongoose.connection.collection(ovenName);

      // Get the latest active ID for the given collection
      let newActiveID = await getLatestActiveID(activeOvenCollection) + 1;

      if (isNaN(newActiveID)) {
        newActiveID = 1;
      }

      activeOvens.set(ovenName, newActiveID);
      console.log(`New activeID for ${ovenName}: ${newActiveID}`);

      await OvenStatus.findOneAndUpdate(
        { ovenName },
        { status: 'Active', timestamp: new Date().toISOString() },
        { upsert: true }
      );

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'statusUpdate', data: { ovenName, status: 'Active', timestamp: new Date().toISOString() } }));
        }
      });
    } else if (parsedData.type === 'stop') {
      const ovenName = parsedData.data.ovenId;
      activeOvens.delete(ovenName);

      await OvenStatus.findOneAndUpdate(
        { ovenName },
        { status: 'Idle', timestamp: new Date().toISOString() },
        { upsert: true }
      );

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'statusUpdate', data: { ovenName, status: 'Idle', timestamp: new Date().toISOString() } }));
        }
      });
    } else {
      const ovenName = parsedData.data.ovenId;
      const formattedTimestamp = parsedData.data.timestamp ? formatTimestampLong(parsedData.data.timestamp) : formatTimestampLong(new Date());

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

        if (activeOvens.has(ovenName)) {
          const activeOvenCollection = mongoose.connection.collection(ovenName);
          const activeID = activeOvens.get(ovenName);
          if (isNaN(activeID)) {
            console.error('Error: activeID is NaN');
            return;
          }
          const newDataObj = newData.toObject();
          newDataObj.activeID = activeID;
          await activeOvenCollection.insertOne(newDataObj);
        }

        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            console.log('Broadcasting message to client:', JSON.stringify({ type: 'newOvenData', data: newData }));
            client.send(JSON.stringify({ type: 'newOvenData', data: newData }));
          }
        });
      } catch (err) {
        console.error('Error saving data:', err.message);
      }
    }
  });

  ws.on('close', async () => {
    if (clientId) {
      console.log(`Client disconnected: ${clientId}`);
      activeOvens.delete(clientId);
      await OvenStatus.findOneAndUpdate(
        { ovenName: clientId },
        { status: 'Disconnected', timestamp: new Date().toISOString() },
        { upsert: true }
      );

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'statusUpdate', data: { ovenName: clientId, status: 'Disconnected', timestamp: new Date().toISOString() } }));
        }
      });
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
app.get('/ovens', async (req, res) => {
  try {
    const ovens = await Oven.find();
    res.json(ovens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/ovens', async (req, res) => {
  const newOven = new Oven(req.body);
  try {
    await newOven.save();
    res.status(201).json(newOven);

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'newOven', data: newOven }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/ovens/:id', async (req, res) => {
  try {
    const updatedOven = await Oven.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedOven) return res.status(404).json({ error: 'Oven not found' });
    res.json(updatedOven);

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'updateOven', data: updatedOven }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/ovens/:id', async (req, res) => {
  try {
    const deletedOven = await Oven.findByIdAndDelete(req.params.id);
    if (!deletedOven) return res.status(404).json({ error: 'Oven not found' });
    res.json(deletedOven);

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'deleteOven', data: deletedOven }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/ovenData', async (req, res) => {
  const formattedTimestamp = req.body.timestamp ? formatTimestampLong(req.body.timestamp) : formatTimestampLong(new Date());
  const newOvenData = new OvenData({ ...req.body, timestamp: formattedTimestamp });
  try {
    await newOvenData.save();
    res.status(201).json(newOvenData);

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'newOvenData', data: newOvenData }));
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Define a new route to get the latest temperatures for all ovens
app.get('/latestOvenTemps', async (req, res) => {
  try {
    // Assuming the OvenData collection has the latest temperature data
    // Modify this logic as needed to fetch the latest data for all ovens
    const latestOvenTemps = await OvenData.aggregate([
      {
        $sort: { timestamp: -1 } // Sort by timestamp in descending order
      },
      {
        $group: {
          _id: "$ovenId",
          ovenId: { $first: "$ovenId" },
          temperature: { $first: "$temperature" },
        }
      }
    ]);

    res.json(latestOvenTemps);
  } catch (error) {
    console.error('Error fetching latest oven temperatures:', error);
    res.status(500).json({ error: 'Error fetching latest oven temperatures' });
  }
});


app.get('/ovenData/:ovenId', async (req, res) => {
  const { type, option, boardNum } = req.query;
  try {
    let filter = { ovenId: req.params.ovenId };
    if (type === 'Board' && option) {
      filter.boardId = boardNum;
    }
    const ovenData = await OvenData.find(filter);
    res.json(ovenData.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/currentStatuses', async (req, res) => {
  try {
    const ovenStatuses = await OvenStatus.find();
    res.json(ovenStatuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const xlsx = require('xlsx');
const fs = require('fs');
// Route to get the highest activeID for a specific oven
app.get('/highestActiveID', async (req, res) => {
  const { ovenName } = req.query;
  try {
    const collectionName = ovenName;
    const collection = db.collection(collectionName);
    const highestActiveID = await collection.findOne({}, { sort: { activeID: -1 } });
    res.json({ highestActiveID: highestActiveID ? highestActiveID.activeID : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Define the /getOvenData endpoint
app.get('/getOvenData', async (req, res) => {
  const { ovenName } = req.query;
  if (!ovenName) {
    return res.status(400).json({ error: 'Oven name is required' });
  }

  try {
    const collectionName = ovenName;
    const collection = db.collection(collectionName);
    const data = await collection.find({}).toArray();
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified oven' });
    }
    console.log(data);
    // Group data by activeID
    const groupedData = data.reduce((acc, item) => {
      acc[item.activeID] = acc[item.activeID] || [];
      acc[item.activeID].push(item);
      return acc;
    }, {});

    // Convert grouped data to an array format with start and end timestamps
    const result = Object.keys(groupedData).sort().map(activeID => {
      const entries = groupedData[activeID];
      return {
        activeID: parseInt(activeID),
        startTimestamp: entries[0].timestamp,
        endTimestamp: entries[entries.length - 1].timestamp,
        entries: entries,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});
// Route to generate Excel file by activeID and ovenId
app.get('/downloadExcel', async (req, res) => {
  const { ovenName, activeID } = req.query;
  try {
    const collectionName = ovenName;
    const collection = db.collection(collectionName);
    const data = await collection.find({ activeID: Number(activeID) }).toArray();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/activeData/:ovenId', async (req, res) => {
  const { type, option, boardNum, activeID } = req.query;
  try {
    let filter = { activeID: Number(activeID) };
    if (type === 'Board' && option) {
      filter.boardId = boardNum;
    }
    const collectionName = req.params.ovenId;
    const collection = db.collection(collectionName);
    const ovenData = await collection.find(filter).toArray();
    res.json(ovenData.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
const HOST = 'localhost';
server.listen(PORT, HOST, () => {
  console.log(`Server is listening on http://${HOST}:${PORT}`);
});
