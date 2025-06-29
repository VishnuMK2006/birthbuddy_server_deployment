const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const connectToMongo = require('./db');
const User = require('./models/User');
const Group = require('./models/Group');

connectToMongo();

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ---------------- AUTH ---------------- */

// Signup
app.post('/api/signup', async (req, res) => {
  const { name, mobile, dob } = req.body;
  try {
    let user = await User.findOne({ mobile });
    if (user) return res.status(400).json({ message: 'User already exists' });

    user = new User({ name, mobile, dob });
    await user.save();
    res.json({ message: 'Signup successful', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { mobile, dob } = req.body;
  try {
    const user = await User.findOne({ mobile, dob });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ---------------- GROUPS ---------------- */

// Create Public Group
app.post('/api/groups/create', async (req, res) => {
  const { name, userId } = req.body;
  try {
    const inviteCode = uuidv4();
    const group = new Group({
      name,
      type: 'public',
      createdBy: userId,
      inviteCode,
      members: [{ userId, role: 'admin' }]
    });

    await group.save();

    await User.findByIdAndUpdate(userId, { $push: { groups: group._id } });

    res.json({ message: 'Group created', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Invite Link
app.get('/api/groups/:id/invite-link', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    res.json({ link: `http://localhost:5000/api/groups/join/${group.inviteCode}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Join Group via Invite Link
app.post('/api/groups/join/:code', async (req, res) => {
  const { userId } = req.body;
  try {
    const group = await Group.findOne({ inviteCode: req.params.code });
    if (!group || group.type !== 'public')
      return res.status(404).json({ message: 'Invalid invite link' });

    const alreadyMember = group.members.find(m => m.userId.toString() === userId);
    if (alreadyMember) return res.status(400).json({ message: 'Already a member' });

    group.members.push({ userId, role: 'member' });
    await group.save();

    await User.findByIdAndUpdate(userId, { $push: { groups: group._id } });

    res.json({ message: 'Joined group successfully', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin Adds Member by Mobile
app.post('/api/groups/:id/add-user', async (req, res) => {
  const { userMobile, adminId } = req.body;
  try {
    const group = await Group.findById(req.params.id);
    const isAdmin = group.members.find(
      m => m.userId.toString() === adminId && m.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ message: 'Not an admin' });

    const user = await User.findOne({ mobile: userMobile });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyMember = group.members.find(m => m.userId.toString() === user._id.toString());
    if (alreadyMember) return res.status(400).json({ message: 'Already a member' });

    group.members.push({ userId: user._id, role: 'member' });
    await group.save();

    user.groups.push(group._id);
    await user.save();

    res.json({ message: 'User added to group', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave Group
app.post('/api/groups/:id/leave', async (req, res) => {
  const { userId } = req.body;
  try {
    const group = await Group.findById(req.params.id);
    group.members = group.members.filter(m => m.userId.toString() !== userId);
    await group.save();

    await User.findByIdAndUpdate(userId, { $pull: { groups: group._id } });

    res.json({ message: 'Left group successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ---------------- SERVER START ---------------- */
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
