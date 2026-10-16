import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  const DATA_DIR = path.join(process.cwd(), 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SHEETS_CONFIG_FILE = path.join(DATA_DIR, 'sheets-config.json');
  const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');

  // GET /api/sheets-config
  app.get('/api/sheets-config', (_req, res) => {
    try {
      if (fs.existsSync(SHEETS_CONFIG_FILE)) {
        const content = fs.readFileSync(SHEETS_CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return res.json({ success: true, config: parsed });
      }
    } catch (err) {
      console.error('Failed to read sheets-config.json:', err);
    }
    return res.json({ success: true, config: null });
  });

  // POST /api/sheets-config
  app.post('/api/sheets-config', (req, res) => {
    try {
      const config = req.body;
      fs.writeFileSync(SHEETS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
      return res.json({
        success: true,
        message: 'Konfigurasi Google Sheets berhasil disimpan di server dan berlaku untuk semua perangkat.',
        config,
      });
    } catch (err) {
      console.error('Failed to save sheets-config.json:', err);
      return res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi ke server.' });
    }
  });

  // GET /api/schedule
  app.get('/api/schedule', (_req, res) => {
    try {
      if (fs.existsSync(SCHEDULE_FILE)) {
        const content = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
        return res.json({ success: true, schedule: JSON.parse(content) });
      }
    } catch (err) {
      console.error('Failed to read schedule.json:', err);
    }
    return res.json({ success: true, schedule: null });
  });

  // POST /api/schedule
  app.post('/api/schedule', (req, res) => {
    try {
      const schedule = req.body;
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2), 'utf-8');
      return res.json({ success: true, message: 'Jadwal berhasil disimpan di server.', schedule });
    } catch (err) {
      console.error('Failed to save schedule.json:', err);
      return res.status(500).json({ success: false, message: 'Gagal menyimpan jadwal ke server.' });
    }
  });

  // Proxy endpoint to handle Google Apps Script CORS issues in restrictive browsers
  app.post('/api/proxy-sheets', async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ success: false, message: 'Webhook URL tidak disertakan.' });
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return res.json(json);
      } catch {
        return res.json({ success: response.ok, raw: text });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ success: false, message: errorMsg });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
