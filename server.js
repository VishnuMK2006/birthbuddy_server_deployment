// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectToMongo = require('./db');
const { v4: uuidv4 } = require('uuid');

const User = require('./models/User');
const Group = require('./models/Group');
const PrivateUser = require('./models/PrivateUser');
const PrivateGroup = require('./models/PrivateGroup');

connectToMongo();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --------------------- AUTH ---------------------
app.post('/api/signup', async (req, res) => {
  const { name, mobile, dob } = req.body;
  try {
    let user = await User.findOne({ mobile });
    if (user) return res.status(400).json({ message: 'User already exists' });

    user = new User({ name, mobile, dob });
    await user.save();
    res.json({ message: 'Signup successful', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { mobile, dob } = req.body;
  try {
    const user = await User.findOne({ mobile, dob });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --------------------- TODAY'S BIRTHDAYS ---------------------
app.get('/api/birthdays/today/:mobile', async (req, res) => {
  try {
    const { mobile } = req.params;
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    // Step 1: Get all public groups the user is part of
    const groups = await Group.find({ members: mobile, type: 'public' });

    // Step 2: Get all members of those groups
    const groupMemberMobiles = [...new Set(groups.flatMap(group => group.members))];

    // Step 3: Fetch public users who are in same group and have birthday today
    const publicUsers = await User.aggregate([
      { $match: { mobile: { $in: groupMemberMobiles } } },
      { $addFields: { day: { $dayOfMonth: "$dob" }, month: { $month: "$dob" } } },
      { $match: { day, month } },
      { $project: { name: 1, mobile: 1, dob: 1, source: { $literal: "public" } } }
    ]);

    // Step 4: Fetch private users created by current user
    const privateUsers = await PrivateUser.aggregate([
      { $match: { createdBy: mobile } },
      { $addFields: { day: { $dayOfMonth: "$dob" }, month: { $month: "$dob" } } },
      { $match: { day, month } },
      { $project: { name: 1, mobile: 1, dob: 1, source: { $literal: "private" } } }
    ]);

    res.json({
      count: publicUsers.length + privateUsers.length,
      birthdays: [...publicUsers, ...privateUsers]
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching birthdays', error: err.message });
  }
});

// --------------------- PUBLIC GROUP ---------------------
app.get('/api/public/:groupId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId).populate('members.userId', 'name mobile dob');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching group', error: err.message });
  }
});

// --------------------- PRIVATE GROUP ---------------------
app.get('/api/private/:groupId', async (req, res) => {
  try {
    const group = await PrivateGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Private group not found' });

    const users = await Promise.all(group.members.map(async m => await PrivateUser.findById(m.privateUserId)));
    res.json({ group, members: users });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching private group', error: err.message });
  }
});
// --------------------- PUBLIC USER ADD ---------------------

app.post('/api/privateuser', async (req, res) => {
  const { name, mobile, dob, createdBy } = req.body;
  try {
    const existing = await PrivateUser.findOne({ mobile, createdBy });
    if (existing) return res.status(400).json({ message: 'Private user already exists for this creator' });

    const user = new PrivateUser({ name, mobile, dob, createdBy });
    await user.save();
    res.json({ message: 'Private user created', user });
  } catch (err) {
    res.status(500).json({ message: 'Error creating private user', error: err.message });
  }
});

// --------------------- PRIVATE GROUP CREATION / LIST ---------------------
app.get('/api/private/creategroup/:userId', async (req, res) => {
  try {
    const groups = await PrivateGroup.find({ createdBy: req.params.userId });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching private groups', error: err.message });
  }
});

app.post('/api/private/creategroup', async (req, res) => {
  const { name, createdBy } = req.body;
  try {
    const group = new PrivateGroup({ name, createdBy });
    await group.save();
    res.json({ message: 'Private group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Error creating group', error: err.message });
  }
});

// --------------------- ADD PRIVATE USER TO GROUP ---------------------
app.post('/api/private/add/:groupId/:userId', async (req, res) => {
  try {
    const group = await PrivateGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Private group not found' });

    const alreadyMember = group.members.some(m => m.privateUserId.toString() === req.params.userId);
    if (alreadyMember) return res.status(400).json({ message: 'User already exists in private group' });

    group.members.push({ privateUserId: req.params.userId });
    await group.save();
    res.json({ message: 'User added to private group', group });
  } catch (err) {
    res.status(500).json({ message: 'Error adding user to group', error: err.message });
  }
});

// --------------------- ADD PUBLIC USER TO GROUP ---------------------
app.post('/api/public/creategroup', async (req, res) => {
  const { name, createdBy } = req.body;
  try {
    const inviteCode = uuidv4();
    const group = new Group({ name, createdBy, inviteCode });
    await group.save();
    res.json({ message: 'Public group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Error creating group', error: err.message });
  }
});

app.post('/api/public/add/:groupId/:userId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Public group not found' });

    const alreadyMember = group.members.some(m => m.userId.toString() === req.params.userId);
    if (alreadyMember) return res.status(400).json({ message: 'User already exists in public group' });

    group.members.push({ userId: req.params.userId });
    await group.save();
    res.json({ message: 'User added to public group', group });
  } catch (err) {
    res.status(500).json({ message: 'Error adding user to group', error: err.message });
  }
});

// --------------------- EDIT PRIVATE USER ---------------------
app.put('/api/private/edit/:groupId/:userId', async (req, res) => {
  try {
    const updated = await PrivateUser.findByIdAndUpdate(req.params.userId, req.body, { new: true });
    res.json({ message: 'Private user updated', user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating private user', error: err.message });
  }
});

// --------------------- EDIT PUBLIC USER ---------------------
app.put('/api/public/edit/:groupId/:userId', async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.userId, req.body, { new: true });
    res.json({ message: 'User updated', user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
});

// --------------------- START SERVER ---------------------
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
