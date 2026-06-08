const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URL || 'mongodb+srv://manushan:Manushan123@fuelsys.9zsctxd.mongodb.net/?appName=fuelsys';
const DB_NAME = 'fuelsys';
let db;

MongoClient.connect(MONGO_URI).then(client => {
  db = client.db(DB_NAME);
  console.log('Connected to MongoDB Atlas');

  // Seed sample data if empty
  db.collection('quotas').countDocuments().then(count => {
    if (count === 0) {
      db.collection('quotas').insertMany([
        { reg_number: 'CBA-1234', max_quota: 20, used: 5 },
        { reg_number: 'WP-5678',  max_quota: 15, used: 15 },
        { reg_number: 'CAB-9988', max_quota: 20, used: 0 },
      ]);
      console.log('Sample data seeded');
    }
  });
}).catch(err => console.error('MongoDB connection error:', err));

// GET all quotas
app.get('/api/quotas', async (req, res) => {
  const quotas = await db.collection('quotas').find().toArray();
  res.json(quotas);
});

// PUT update quota limit for a vehicle
app.put('/api/quotas/:id', async (req, res) => {
  const { max_quota } = req.body;
  const result = await db.collection('quotas').findOneAndUpdate(
    { _id: new ObjectId(req.params.id) },
    { $set: { max_quota: Number(max_quota) } },
    { returnDocument: 'after' }
  );
  res.json(result);
});

// GET all fuel orders
app.get('/api/orders', async (req, res) => {
  const orders = await db.collection('orders').find().sort({ created_at: -1 }).toArray();
  res.json(orders);
});

// POST new fuel order (worker submits)
app.post('/api/orders', async (req, res) => {
  const { reg_number, requested_liters } = req.body;

  if (!reg_number || !requested_liters) {
    return res.status(400).json({ error: 'reg_number and requested_liters are required' });
  }

  // Find vehicle quota
  const quota = await db.collection('quotas').findOne({ reg_number: reg_number.toUpperCase() });
  if (!quota) {
    return res.status(404).json({ error: 'Vehicle not registered in the system' });
  }

  const remaining = quota.max_quota - quota.used;
  if (Number(requested_liters) > remaining) {
    return res.status(400).json({ error: `Only ${remaining}L remaining for this vehicle` });
  }

  // Deduct from quota
  await db.collection('quotas').updateOne(
    { _id: quota._id },
    { $inc: { used: Number(requested_liters) } }
  );

  // Save order
  const order = {
    reg_number: reg_number.toUpperCase(),
    requested_liters: Number(requested_liters),
    created_at: new Date()
  };
  const result = await db.collection('orders').insertOne(order);
  res.json({ ...order, _id: result.insertedId });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
