export const SAMPLE_PRS = [
  {
    id: 'vulnerable-login',
    title: 'Add user login endpoint',
    description: 'Implements a POST /login endpoint that accepts username and password, validates against the database, and returns a JWT token on success.',
    files: [
      {
        name: 'src/routes/auth.js',
        language: 'javascript',
        diff: `+const express = require('express');
+const db = require('../db');
+const jwt = require('jsonwebtoken');
+
+const router = express.Router();
+
+router.post('/login', async (req, res) => {
+  const { username, password } = req.body;
+
+  // Query user from database
+  const query = \`SELECT * FROM users WHERE username = '\${username}' AND password = '\${password}'\`;
+  const user = await db.query(query);
+
+  if (!user.rows.length) {
+    return res.status(401).json({ error: 'Invalid credentials' });
+  }
+
+  const token = jwt.sign(
+    { userId: user.rows[0].id, role: user.rows[0].role },
+    'mysecretkey123',
+    { expiresIn: '30d' }
+  );
+
+  res.json({ token, user: user.rows[0] });
+});
+
+module.exports = router;`
      },
      {
        name: 'src/middleware/requireAuth.js',
        language: 'javascript',
        diff: `+const jwt = require('jsonwebtoken');
+
+module.exports = function requireAuth(req, res, next) {
+  const token = req.headers['authorization'];
+
+  if (!token) {
+    return res.status(401).json({ error: 'No token provided' });
+  }
+
+  try {
+    const decoded = jwt.verify(token, 'mysecretkey123');
+    req.user = decoded;
+    next();
+  } catch (err) {
+    res.status(401).json({ error: 'Invalid token' });
+  }
+};`
      }
    ]
  },
  {
    id: 'clean-refactor',
    title: 'Centralize API response formatting',
    description: 'Extracts response shape logic into a shared utility so all endpoints return consistent JSON structures.',
    files: [
      {
        name: 'src/utils/response.js',
        language: 'javascript',
        diff: `+/**
+ * Utility functions for consistent API responses across all endpoints.
+ */
+
+export const success = (data, message = 'OK') => ({
+  success: true,
+  message,
+  data,
+  timestamp: new Date().toISOString()
+});
+
+export const error = (message, code = 'INTERNAL_ERROR', details = null) => ({
+  success: false,
+  error: { code, message, details },
+  timestamp: new Date().toISOString()
+});
+
+export const paginated = (data, { page, pageSize, total }) => ({
+  success: true,
+  data,
+  pagination: {
+    page,
+    pageSize,
+    total,
+    totalPages: Math.ceil(total / pageSize)
+  },
+  timestamp: new Date().toISOString()
+});`
      },
      {
        name: 'src/routes/users.js',
        language: 'javascript',
        diff: `-  res.json({ data: users, count: users.length });
+  res.json(paginated(users, { page, pageSize, total: count }));

-  res.status(404).json({ error: 'User not found' });
+  res.status(404).json(error('User not found', 'NOT_FOUND'));

-  res.json(user);
+  res.json(success(user));`
      }
    ]
  }
];
