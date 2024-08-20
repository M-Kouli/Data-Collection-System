const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mongoose = require('mongoose');
const OvenData = require('./models/OvenData');
const OvenStatus = require('./models/OvenStatus');
const Event = require('./models/Event'); // Add this line to import the Event model
const WarningSettings = require('./models/WarningSettings');  // Import the new model

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const { auth, requiresAuth } = require('express-openid-connect');

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: 'a long, randomly-generated string stored in env',
  baseURL: 'http://localhost:3000',
  clientID: 'kxM8PAgOFbPFdqyRZlFbpjfTB0vHAHQK',
  issuerBaseURL: 'https://dev-b8nsr1hwcnb1jo2a.us.auth0.com'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));
// Middleware
app.use(express.static('public'));
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost/OvenMonitoring', {
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
        temperatureUpperControlLimit: { 
          type: Number, 
          required: function() { return this.hasOvenControlLimits === true; } 
        },
        temperatureLowerControlLimit: { 
          type: Number, 
          required: function() { return this.hasOvenControlLimits === true; } 
        },
        dataType: { type: String, enum: ['Oven', 'Board'], required: true },
        hasOvenControlLimits: { type: Boolean, required: function() { return this.dataType === 'Oven'; } },
        hasBoardControlLimits: { type: Boolean, required: function() { return this.dataType === 'Board'; } },
        boardId: { type: String, required: function() { return this.dataType === 'Board'; } },
        p1: { type: Number, default: null },
        p1UpperControlLimit: { type: Number, default: null },
        p1LowerControlLimit: { type: Number, default: null },
        p2: { type: Number, default: null },
        p2UpperControlLimit: { type: Number, default: null },
        p2LowerControlLimit: { type: Number, default: null },
        t1: { type: Number, default: null },
        t1UpperControlLimit: { type: Number, default: null },
        t1LowerControlLimit: { type: Number, default: null },
        t2: { type: Number, default: null },
        t2UpperControlLimit: { type: Number, default: null },
        t2LowerControlLimit: { type: Number, default: null },
        vx: { type: Number, default: null },
        vxUpperControlLimit: { type: Number, default: null },
        vxLowerControlLimit: { type: Number, default: null },
        vz: { type: Number, default: null },
        vzUpperControlLimit: { type: Number, default: null },
        vzLowerControlLimit: { type: Number, default: null },
        ct: { type: Number, default: null },
        ctUpperControlLimit: { type: Number, default: null },
        ctLowerControlLimit: { type: Number, default: null },
        vt: { type: Number, default: null },
        vtUpperControlLimit: { type: Number, default: null },
        vtLowerControlLimit: { type: Number, default: null },
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

async function checkForOutliers(data) {
  let ovenOutliersCount = 0;
  let boardsWithOutliers = {};

  for (const d of data) {
    // Check the status of the oven before processing
    const ovenStatus = await OvenStatus.findOne({ ovenName: d.ovenId }).exec();

    if (!ovenStatus || ovenStatus.status !== 'Active') {
      console.log(`Skipping data for oven ${d.ovenId} because it is not active.`);
      continue; // Skip processing if the oven is not active
    }

    // Check for oven temperature outliers
    if (d.dataType === 'Oven' && d.temperature !== undefined) {
      if (d.temperatureUpperControlLimit !== null && d.temperatureLowerControlLimit !== null) {
        if (d.temperature > d.temperatureUpperControlLimit || d.temperature < d.temperatureLowerControlLimit) {
          ovenOutliersCount++;
          await triggerWarning(d.ovenId, 'Temperature Out of Range');
        }
      }
    }

    // Check for board parameter outliers
    if (d.dataType === 'Board') {
      const boardId = d.boardId;
      if (!boardsWithOutliers[boardId]) {
        boardsWithOutliers[boardId] = { failures: {}, totalFails: 0 };
      }

      const parameters = ['p1', 'p2', 't1', 't2', 'vx', 'vz', 'ct', 'vt'];

      parameters.forEach(async param => {
        if (d[param] !== undefined) {
          const lowerLimit = d[`${param}LowerControlLimit`];
          const upperLimit = d[`${param}UpperControlLimit`];
          if (lowerLimit !== null && upperLimit !== null) {
            if (d[param] < lowerLimit || d[param] > upperLimit) {
              if (!boardsWithOutliers[boardId].failures[param]) {
                boardsWithOutliers[boardId].failures[param] = 0;
              }
              boardsWithOutliers[boardId].failures[param]++;
              boardsWithOutliers[boardId].totalFails++;
              await triggerWarning(d.ovenId, `${param} Out of Range`);
            }
          }
        }
      });
    }
  }

  console.log(ovenOutliersCount); // Number of oven temperature outliers
  console.log(boardsWithOutliers); // Log of boards with exceeded limits and parameters
  // Optional: Store or log outliers here if needed
}


async function triggerWarning(ovenId, failureType) {
  console.log(`Processing warning for ${ovenId}: ${failureType}`);

  // Fetch or create warning settings for the oven
  let warningSettings = await WarningSettings.findOne({ ovenName: ovenId }).exec();
  if (!warningSettings) {
    warningSettings = new WarningSettings({ ovenName: ovenId });
  }

  // Check if warnings are enabled for this oven
  if (!warningSettings.warningsEnabled) {
    console.log(`Warnings are disabled for oven ${ovenId}.`);
    return;  // Exit if warnings are disabled
  }

  // Update the failure tracker
  warningSettings.failureTracker.count++;
  warningSettings.failureTracker.failures.push(failureType);
  
  // Save the updated settings
  await warningSettings.save();

  // Send the warning to all connected WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'warning',
        data: {
          ovenId,
          failureType,
          failureTracker: {
            count: warningSettings.failureTracker.count,
            failures: [...new Set(warningSettings.failureTracker.failures)], // Remove duplicates
          }
        }
      }));
    }
  });
}
// Map to store WebSocket connections by clientId
const activeWebSockets = new Map();
// Server-side WebSocket handling
wss.on('connection', async(ws) => {
  let clientId;
  console.log('Client connected');
  // Check for any existing warnings for all ovens and send them to the newly connected client
  const allWarnings = await WarningSettings.find({}).exec();  // Find all warning documents
  allWarnings.forEach(warningSettings => {
    if (warningSettings.failureTracker.count > 0) {
      ws.send(JSON.stringify({
        type: 'warning',
        data: {
          ovenId: warningSettings.ovenName,
          failureType: "All Failures",
          failureTracker: warningSettings.failureTracker,
        }
      }));
    }
  });
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
      activeWebSockets.set(clientId, ws); // Store the WebSocket connection
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
      // Reset the failure tracker when the oven is no longer active
      const result = await WarningSettings.findOneAndUpdate(
        { ovenName: ovenName },
        { $set: { 'failureTracker.count': 0, 'failureTracker.failures': [] } },
        { new: true }
      );

      if (!result) {
        console.error(`Failed to reset failure tracker for oven: ${ovenName}`);
      } else {
        console.log(`Successfully reset failure tracker for oven: ${ovenName}`);
        console.log(result); // Log the updated document to verify the changes
      }


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
        temperatureUpperControlLimit: parsedData.data.temperatureUpperControlLimit,
        temperatureLowerControlLimit: parsedData.data.temperatureLowerControlLimit,
        hasOvenControlLimits: parsedData.data.hasOvenControlLimits,
        hasBoardControlLimits: parsedData.data.hasBoardControlLimits,
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
        // Perform outlier detection
        await checkForOutliers([newData]);

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
      activeWebSockets.delete(clientId); // Remove the WebSocket connection
      await OvenStatus.findOneAndUpdate(
        { ovenName: clientId },
        { status: 'Disconnected', timestamp: new Date().toISOString() },
        { upsert: true }
      );
      // Reset the failure tracker when the oven is no longer active
      const result = await WarningSettings.findOneAndUpdate(
        { ovenName: clientId },
        { $set: { 'failureTracker.count': 0, 'failureTracker.failures': [] } },
        { new: true }
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

app.get('/devices',(req, res) => {
  res.sendFile(path.join(__dirname + '/views/devices.html'));
});
app.get('/fileManager', (req, res) => {
  res.sendFile(path.join(__dirname + '/views/filelog.html'));
});
app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname + '/views/settings.html'));
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


// Define event creation route
app.post('/events', async (req, res) => {
  const { title, notes, start, end, ovenId } = req.body;
  if (!title || !notes || !start || !end || !ovenId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const eventId = new mongoose.Types.ObjectId(); // Generate a unique eventId
  const newEvent = new Event({ eventId, title, notes, start, end, ovenId });
  try {
    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Define event update route
app.put('/events/:eventId', async (req, res) => {
  const { title, notes, start, end, ovenId } = req.body;
  if (!title || !notes || !start || !end || !ovenId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const updatedEvent = await Event.findOneAndUpdate(
      { eventId: req.params.eventId },
      { title, notes, start, end, ovenId },
      { new: true }
    );
    if (!updatedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(updatedEvent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Define event deletion route
app.delete('/events/:eventId', async (req, res) => {
  try {
    const deletedEvent = await Event.findOneAndDelete({ eventId: req.params.eventId });
    if (!deletedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(deletedEvent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// Fetch events for a specific oven
app.get('/events', async (req, res) => {
  const { ovenId } = req.query;
  try {
    const events = await Event.find({ ovenId });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// New endpoint to get event counts within a date range
app.get('/eventCountsInRange', async (req, res) => {
  const { start, end, ovenId } = req.query;
  if (!start || !end || !ovenId) {
      return res.status(400).json({ error: 'Missing start, end date, or ovenId' });
  }

  try {
      // Adjust start and end times to include the entire day
      const adjustedStart = new Date(new Date(start).setHours(0, 0, 0, 100));
      const adjustedEnd = new Date(new Date(end).setHours(23, 59, 59, 0));

      console.log(`Fetching events for oven ${ovenId} from ${adjustedStart.toISOString()} to ${adjustedEnd.toISOString()}`);
      const events = await Event.find({
          ovenId,
          $or: [
            { start: { $gte: adjustedStart, $lte: adjustedEnd } },
            { end: { $gte: adjustedStart, $lte: adjustedEnd } },
            { start: { $lte: adjustedStart }, end: { $gte: adjustedEnd } }
          ]
      });
      console.log(`Found ${events.length} events`);

      const plannedCount = events.filter(event => event.title.startsWith('Planned')).length;
      const unplannedCount = events.filter(event => event.title.startsWith('Unplanned')).length;

      const response = {
          total: events.length,
          planned: plannedCount,
          unplanned: unplannedCount
      };

      res.json(response);
  } catch (error) {
      console.error('Error fetching events:', error.message);
      res.status(500).json({ error: error.message });
  }
});

// New endpoint to get events within a date range
app.get('/eventsInRange', async (req, res) => {
  const { start, end, ovenId } = req.query;
  if (!start || !end || !ovenId) {
    return res.status(400).json({ error: 'Missing start, end date, or ovenId' });
  }

  try {
          // Adjust start and end times to include the entire day
          const adjustedStart = new Date(new Date(start).setHours(0, 0, 0, 100));
          const adjustedEnd = new Date(new Date(end).setHours(23, 59, 59, 0));
    const events = await Event.find({
      ovenId,
      $or: [
        { start: { $gte: adjustedStart, $lte: adjustedEnd } },
        { end: { $gte: adjustedStart, $lte: adjustedEnd } },
        { start: { $lte: adjustedStart }, end: { $gte: adjustedEnd } }
      ]
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get the the closest event to the current time
app.get('/closestEvent', async (req, res) => {
  const{ovenId} = req.query;
  const currentTime = new Date();
  try {
    const events = await Event.find({ovenId});
    const closestEvent = events
      .filter(event => event.start >= currentTime && event.end >= currentTime)
      .sort((a, b) => a.start - b.start)[0];
    if (closestEvent === undefined) {
      res.json([]);
    } else {
      res.json(closestEvent);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to toggle warnings for a specific oven
app.post('/api/oven/:ovenId/toggleWarnings', async (req, res) => {
  const { ovenId } = req.params;
  const { enableWarnings } = req.body; // Expecting a boolean value in the request body
  console.log(ovenId)
  try {
    const updatedSettings = await WarningSettings.findOneAndUpdate(
      { ovenName: ovenId },
      { $set: { warningsEnabled: enableWarnings } }
    );

    if (!updatedSettings) {
      return res.status(404).json({ error: 'Oven not found' });
    }

    res.json({ message: `Warnings for oven ${ovenId} have been ${enableWarnings ? 'disabled' : 'enabled'}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update warning settings.' });
  }
});


// Endpoint to end the connection with a specific oven
app.post('/api/oven/:ovenId/endConnection', async (req, res) => {
  const { ovenId } = req.params;

  try {
    // Remove the oven from the active ovens map
    activeOvens.delete(ovenId);

    // Force close the WebSocket connection if it exists
    const ws = activeWebSockets.get(ovenId);
    if (ws) {
      ws.terminate(); // Forcefully close the WebSocket connection
      activeWebSockets.delete(ovenId); // Remove it from the active connections map
    }

    // Update the oven's status in the database
    await OvenStatus.findOneAndUpdate(
      { ovenName: ovenId },
      { status: 'Disconnected', timestamp: new Date().toISOString() }
    );

    res.json({ message: `Connection with oven ${ovenId} has been ended.` });
  } catch (err) {
    console.error(`Failed to end connection for oven ${ovenId}:`, err);
    res.status(500).json({ error: 'Failed to end connection.' });
  }
});


const PORT = 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server is listening on http://${HOST}:${PORT}`);
});
