const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = 'your_secret_key'; // In production, use environment variable

app.use(cors());
app.use(express.json());

// Initialize database
const db = new sqlite3.Database('./mlm.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    createTables();
  }
});

// Create tables
function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    password TEXT NOT NULL,
    sponsor_code TEXT,
    left_member_id INTEGER,
    right_member_id INTEGER,
    left_count INTEGER DEFAULT 0,
    right_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Register member
app.post('/api/register', async (req, res) => {
  const { name, email, mobile, password, sponsor_code, position } = req.body;

  if (!name || !email || !mobile || !password || !sponsor_code || !position) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!['left', 'right'].includes(position.toLowerCase())) {
    return res.status(400).json({ error: 'Position must be left or right' });
  }

  try {
    // Check if sponsor exists
    db.get('SELECT id FROM members WHERE member_code = ?', [sponsor_code], async (err, sponsor) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!sponsor) return res.status(400).json({ error: 'Invalid sponsor code' });

      // Generate member code
      const memberCode = 'MEM' + Date.now();

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Find placement
      findPlacement(sponsor.id, position.toLowerCase(), (placementId, side) => {
        if (!placementId) return res.status(400).json({ error: 'No available position' });

        // Insert new member
        db.run(`INSERT INTO members (member_code, name, email, mobile, password, sponsor_code, ${side}_member_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [memberCode, name, email, mobile, hashedPassword, sponsor_code, placementId],
          function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create member' });

            const newMemberId = this.lastID;

            // Update placement
            db.run(`UPDATE members SET ${side}_member_id = ? WHERE id = ?`, [newMemberId, placementId]);

            // Update counts
            updateCounts(placementId);

            res.status(201).json({ message: 'Member registered successfully', member_code: memberCode });
          });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Find placement with spill logic
function findPlacement(sponsorId, position, callback) {
  db.get('SELECT left_member_id, right_member_id FROM members WHERE id = ?', [sponsorId], (err, row) => {
    if (err) return callback(null, null);

    if (position === 'left') {
      if (!row.left_member_id) {
        return callback(sponsorId, 'left');
      } else {
        // Spill to left child's left
        findPlacement(row.left_member_id, 'left', callback);
      }
    } else {
      if (!row.right_member_id) {
        return callback(sponsorId, 'right');
      } else {
        // Spill to right child's right
        findPlacement(row.right_member_id, 'right', callback);
      }
    }
  });
}

// Update counts recursively
function updateCounts(memberId) {
  db.get('SELECT sponsor_code FROM members WHERE id = ?', [memberId], (err, row) => {
    if (err || !row.sponsor_code) return;

    db.get('SELECT id FROM members WHERE member_code = ?', [row.sponsor_code], (err, sponsor) => {
      if (err || !sponsor) return;

      // Determine if left or right
      db.get('SELECT left_member_id, right_member_id FROM members WHERE id = ?', [sponsor.id], (err, sponsorRow) => {
        if (err) return;

        let side = null;
        if (sponsorRow.left_member_id == memberId) side = 'left';
        else if (sponsorRow.right_member_id == memberId) side = 'right';

        if (side) {
          db.run(`UPDATE members SET ${side}_count = ${side}_count + 1 WHERE id = ?`, [sponsor.id]);
          updateCounts(sponsor.id);
        }
      });
    });
  });
}

// Login
app.post('/api/login', (req, res) => {
  const { member_code, password } = req.body;

  if (!member_code || !password) {
    return res.status(400).json({ error: 'Member code and password required' });
  }

  db.get('SELECT * FROM members WHERE member_code = ?', [member_code], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, member_code: user.member_code }, SECRET_KEY);
    res.json({ token, user: { id: user.id, member_code: user.member_code, name: user.name } });
  });
});

// Get profile
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, member_code, name, email, mobile, sponsor_code, left_count, right_count FROM members WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// Get downline
app.get('/api/downline', authenticateToken, (req, res) => {
  const getDownline = (memberId, callback) => {
    db.all(`
      SELECT m.id, m.member_code, m.name, 
             CASE WHEN p.left_member_id = m.id THEN 'left' ELSE 'right' END as position
      FROM members m
      JOIN members p ON p.left_member_id = m.id OR p.right_member_id = m.id
      WHERE p.id = ?
    `, [memberId], (err, rows) => {
      if (err) return callback(err, null);

      const downline = { left: [], right: [] };
      rows.forEach(row => {
        downline[row.position].push({ id: row.id, member_code: row.member_code, name: row.name });
      });

      callback(null, downline);
    });
  };

  getDownline(req.user.id, (err, downline) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(downline);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});