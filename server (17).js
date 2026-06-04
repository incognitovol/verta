// VERTA — server: serves the pages AND relays sensor data from phones to the dashboard.
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();

// Serve everything in the /public folder (sensor.html, dashboard.html, index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Opening the root URL sends you to the dashboard.
app.get('/', (req, res) => res.redirect('/dashboard.html'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Keep track of connected dashboards (the laptop screens watching the data)
const dashboards = new Set();

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    // A dashboard announces itself so we know to send it data
    if (msg.type === 'hello' && msg.role === 'dashboard') {
      dashboards.add(ws);
      return;
    }

    // A phone sends a motion packet -> forward it to every dashboard
    if (msg.type === 'data') {
      const out = JSON.stringify(msg);
      dashboards.forEach((d) => {
        if (d.readyState === 1) d.send(out);
      });
    }
  });

  ws.on('close', () => dashboards.delete(ws));
  ws.on('error', () => dashboards.delete(ws));
});

// Heartbeat so idle connections don't get dropped
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 30000);
wss.on('close', () => clearInterval(interval));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('VERTA server running on port ' + PORT));
