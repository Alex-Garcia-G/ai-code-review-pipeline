import pool from './db.js';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'http://localhost:3000';

export function startOAuth(_req, res) {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: 'read:user',
    redirect_uri: `${BASE_URL}/auth/github/callback`
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

export async function handleCallback(req, res) {
  const { code } = req.query;
  if (!code) return res.redirect('/');

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      })
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) return res.redirect('/');

    // Fetch user profile from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'ai-code-review-pipeline' }
    });
    const profile = await userRes.json();

    const user = {
      id: String(profile.id),
      username: profile.login,
      name: profile.name || profile.login,
      avatar_url: profile.avatar_url
    };

    // Save or update user in database (non-critical — session works without it)
    try {
      await pool.query(
        `INSERT INTO users (id, username, name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET username = $2, name = $3, avatar_url = $4`,
        [user.id, user.username, user.name, user.avatar_url]
      );
    } catch (err) {
      console.error('Could not save user to database:', err.message);
    }

    req.session.user = user;
    req.session.save(() => res.redirect('/'));
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/');
  }
}

export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
