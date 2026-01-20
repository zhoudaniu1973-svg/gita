/**
 * Local dev server
 * Runs Vite frontend + Express API
 */
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import searchHandler from './api/search.js';
import fetchHandler from './api/fetch.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ===== API endpoints (reuse /api handlers) =====
app.get('/api/search', (req, res) => searchHandler(req, res));
app.options('/api/search', (req, res) => searchHandler(req, res));

app.post('/api/fetch', (req, res) => fetchHandler(req, res));
app.options('/api/fetch', (req, res) => fetchHandler(req, res));

// ===== Start server =====
async function startServer() {
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
    });

    app.use(vite.middlewares);

    app.listen(PORT, () => {
        console.log(`\n  GuitarTab Dev Server`);
        console.log(`  Local:   http://localhost:${PORT}/`);
        console.log(`  API:     http://localhost:${PORT}/api/search?q=test\n`);
    });
}

startServer();
