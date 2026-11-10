import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const puyalDir = path.join(__dirname, 'puyal');

// Serve static assets with html extension support
app.use(express.static(puyalDir, { extensions: ['html'] }));
app.use('/puyal', express.static(puyalDir, { extensions: ['html'] }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Explicit route for root
app.get('/', (req, res) => {
  res.sendFile(path.join(puyalDir, 'index.html'));
});

// Fallback for SPA/static routing if needed
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const potentialFile = path.join(puyalDir, req.path.replace(/^\//, '') + '.html');
    res.sendFile(potentialFile, (err) => {
      if (err) {
        res.sendFile(path.join(puyalDir, 'index.html'));
      }
    });
  } else {
    next();
  }
});

app.listen(PORT, HOST, () => {
  console.log(`RapidResponse server running at http://${HOST}:${PORT}`);
});
