import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

interface MessageRow {
  message_id: string;
  user_id: string;
  conversation_type: string;
  group_id: string;
  business_id: string;
  sender_user_id: string;
  created_at: string;
  message_text: string;
  media_type: string;
  media_id: string;
  forwarded_count: string;
}

const parseCSV = (csv: string): MessageRow[] => {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',');
  const rows: MessageRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    // Basic CSV parser for quoted strings
    const row = lines[i];
    const values: string[] = [];
    let insideQuote = false;
    let currentValue = '';
    
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue);
    
    // Only process valid rows
    if (values.length >= headers.length) {
      rows.push({
        message_id: values[0],
        user_id: values[1],
        conversation_type: values[2],
        group_id: values[3],
        business_id: values[4],
        sender_user_id: values[5],
        created_at: values[6],
        message_text: values[7],
        media_type: values[8],
        media_id: values[9],
        forwarded_count: values[10]
      });
    }
  }
  return rows;
};

const messagesStr = fs.readFileSync(path.join(process.cwd(), 'messages.csv'), 'utf-8');
const parsedMessages = parseCSV(messagesStr).slice(0, 5); // Take 5 samples

const generateDecision = (msg: MessageRow) => {
  // Simple heuristic based on text and attributes
  const text = msg.message_text.toLowerCase();
  
  if (text.includes('urgent') || text.includes('expire') || text.includes('immediately')) {
    return {
      action: 'notify',
      reason: 'Urgent action required based on keywords.',
      confidence: 96.5,
      evidenceIds: ['nlp_urgency_high', 'time_sensitive'],
      trustScore: 88,
      spamProbability: 5,
      urgency: 90,
      reflectionResult: 'Time-critical content verified. Immediate notification warranted.',
    };
  } else if (text.includes('blessing') || text.includes('forward')) {
    return {
      action: 'mute',
      reason: 'Detected chain message or spam.',
      confidence: 99.2,
      evidenceIds: ['spam_chain', 'forward_pattern'],
      trustScore: 10,
      spamProbability: 95,
      urgency: 5,
      reflectionResult: 'Matches known chain message patterns. Muted successfully.',
    };
  } else if (msg.conversation_type === 'business') {
    return {
      action: 'digest',
      reason: 'Standard business or promotional update.',
      confidence: 92.0,
      evidenceIds: ['sender_business', 'informational_content'],
      trustScore: 90,
      spamProbability: 10,
      urgency: 20,
      reflectionResult: 'Safe business update but not time-critical. Added to digest.',
    };
  } else {
    return {
      action: 'digest',
      reason: 'Casual conversation or low priority message.',
      confidence: 88.5,
      evidenceIds: ['social_interaction', 'low_urgency'],
      trustScore: 95,
      spamProbability: 0,
      urgency: 15,
      reflectionResult: 'Standard conversation. No immediate notification needed.',
    };
  }
};

const scenarios = parsedMessages.map((msg, idx) => ({
  id: msg.message_id,
  label: msg.conversation_type === 'business' ? 'Business Update' : (msg.conversation_type === 'group' ? 'Group Message' : 'Personal Message'),
  icon: msg.conversation_type === 'business' ? 'Briefcase' : 'MessageSquare',
  description: msg.message_text,
  sender: msg.sender_user_id || msg.business_id || 'Unknown',
  type: msg.conversation_type,
  decision: generateDecision(msg)
}));

// Mock Simulation states
const activeSimulations = new Map();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // API Routes
  app.get('/api/simulation/analytics', (req, res) => {
    res.json({
      totalProcessed: 12504,
      avgProcessingTimeMs: 450,
      accuracyRate: 99.2,
      spamCaught: 3420,
      uptime: '99.9%'
    });
  });

  app.get('/api/simulation/scenarios', (req, res) => {
    res.json(scenarios);
  });

  app.post('/api/simulation/start', (req, res) => {
    const { scenarioId } = req.body;
    const scenario = scenarios.find(s => s.id === scenarioId) || scenarios[0];
    
    const simulationId = `sim_${Date.now()}`;
    activeSimulations.set(simulationId, {
      id: simulationId,
      scenarioId: scenario.id,
      status: 'running',
      currentStep: 0,
      totalSteps: 10,
      progress: 0,
      decision: scenario.decision
    });
    
    res.json({ simulationId });
  });

  app.get('/api/simulation/:id/status', (req, res) => {
    const sim = activeSimulations.get(req.params.id);
    if (!sim) {
      return res.status(404).json({ error: 'Simulation not found' });
    }
    
    if (sim.status === 'running') {
      sim.currentStep += 2;
      sim.progress = (sim.currentStep / sim.totalSteps) * 100;
      
      if (sim.currentStep >= sim.totalSteps) {
        sim.status = 'completed';
      }
    }
    
    res.json(sim);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
