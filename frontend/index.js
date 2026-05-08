// Entry point for Firebase App Hosting
import sirv from 'sirv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 8080;

const assets = sirv(path.join(__dirname, 'dist'), {
  maxAge: 31536000, // 1Y
  immutable: true,
  single: true,
});

http.createServer(assets).listen(port, err => {
  if (err) throw err;
  console.log(`> Ready on http://localhost:${port}`);
});
