import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, '.data');

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Helper to read/write JSON files
async function readJsonFile(filename, defaultValue = []) {
    try {
        const data = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
        return JSON.parse(data);
    } catch {
        return defaultValue;
    }
}

async function writeJsonFile(filename, data) {
    await ensureDataDir();
    await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

// ==== API Routes for AI Configs ====
app.get('/api/ai-configs', async (req, res) => {
    const data = await readJsonFile('ai_configs.json');
    res.json(data);
});

app.post('/api/ai-configs', async (req, res) => {
    await writeJsonFile('ai_configs.json', req.body);
    res.json({ success: true });
});

// ==== API Routes for Chat Rooms ====
app.get('/api/chat-rooms', async (req, res) => {
    const data = await readJsonFile('chat_rooms.json');
    res.json(data);
});

app.post('/api/chat-rooms', async (req, res) => {
    await writeJsonFile('chat_rooms.json', req.body);
    res.json({ success: true });
});

app.delete('/api/chat-rooms/:id', async (req, res) => {
    const roomId = req.params.id;
    const rooms = await readJsonFile('chat_rooms.json');
    const newRooms = rooms.filter(r => r.id !== roomId);
    await writeJsonFile('chat_rooms.json', newRooms);
    
    // Also delete messages for this room
    try {
        await fs.unlink(path.join(DATA_DIR, `messages_${roomId}.json`));
    } catch {
        // Ignore if file doesn't exist
    }
    
    res.json({ success: true });
});

// ==== API Routes for Messages ====
app.get('/api/messages/:roomId', async (req, res) => {
    const data = await readJsonFile(`messages_${req.params.roomId}.json`);
    res.json(data);
});

app.post('/api/messages/:roomId', async (req, res) => {
    await writeJsonFile(`messages_${req.params.roomId}.json`, req.body);
    res.json({ success: true });
});

const PORT = 5433;
app.listen(PORT, async () => {
    await ensureDataDir();
    console.log(`Backend server running on http://localhost:${PORT}`);
});
