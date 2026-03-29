const express = require('express');
const { execFile } = require('child_process');
const cors = require('cors');

const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Write cookies from env variable on startup
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
if (process.env.YT_COOKIES_B64) {
  fs.writeFileSync(COOKIES_PATH, Buffer.from(process.env.YT_COOKIES_B64, 'base64').toString());
  console.log('YouTube cookies loaded from environment');
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'redline-api' });
});

app.post('/', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ status: 'error', error: 'No URL provided' });

  // Validate URL is YouTube or Twitter
  const allowed = /youtube\.com|youtu\.be|twitter\.com|x\.com/;
  if (!allowed.test(url)) {
    return res.status(400).json({ status: 'error', error: 'Unsupported URL' });
  }

  // Get direct audio URL using yt-dlp
  const cookiesPath = COOKIES_PATH;
  const args = [
    '--no-warnings',
    '--no-playlist',
    '--cookies', cookiesPath,
    '-f', 'ba/b',
    '--get-url',
    '--get-filename',
    '-o', '%(title)s - %(uploader)s.%(ext)s',
    url
  ];

  execFile('yt-dlp', args, { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('yt-dlp error:', stderr || err.message);
      return res.status(500).json({
        status: 'error',
        error: stderr?.split('\n').find(l => l.includes('ERROR')) || 'Failed to extract audio'
      });
    }

    const lines = stdout.trim().split('\n').filter(l => l);
    if (lines.length < 2) {
      return res.status(500).json({ status: 'error', error: 'No audio stream found' });
    }

    const audioUrl = lines[0];
    const filename = lines[1];

    res.json({
      status: 'tunnel',
      url: audioUrl,
      filename: filename
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Redline API running on port ${PORT}`));
