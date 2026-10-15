# AI Notification Router

## 1. Project Overview
AI Notification Router is an intelligent, context-aware notification management system that automatically classifies and routes WhatsApp-style messages. Powered by Google Gemini, it processes incoming messages and makes deterministic routing decisions (Notify, Digest, or Mute) to combat notification fatigue while ensuring critical alerts are never missed.

## 2. Problem Statement
Modern users are overwhelmed by constant digital interruptions. Messaging apps deliver everything from urgent work updates to spam and casual chatter with the same level of urgency. This notification fatigue leads to missed important messages, decreased productivity, and increased cognitive load. Existing "Do Not Disturb" features are too rigid, often relying on simple keywords or static contact lists rather than understanding context.

## 3. Our Solution
We built a multi-agent AI system that acts as a personal notification concierge. By analyzing message content, sender history, relationship context, and multimodal attachments (images/voice notes), the system intelligently categorizes messages and routes them appropriately. It understands the nuance between an urgent request from a boss and a casual meme from a friend, filtering out spam while instantly delivering what matters.

## 4. Key Features
- **Context-Aware Routing**: Evaluates messages based on content, sender history, and engagement metrics.
- **Multimodal Processing**: Analyzes text, images (OCR & vision), and voice notes (transcription & tone analysis).
- **Multi-Agent Architecture**: Uses a Router Agent for initial classification and a Reflection Agent for self-correction and escalation.
- **Deterministic Calibration**: Ensures AI outputs adhere to strict schemas and confidence thresholds.
- **Rich Dashboard UI**: Features a beautiful, interactive React dashboard and Phone Simulator to visualize the AI decision pipeline in real-time.
- **Batch Processing Engine**: Robust async pipeline for processing bulk message datasets with rate limiting and circuit breakers.

## 5. System Architecture
The system is divided into a robust Python backend for bulk processing and AI orchestration, and a React/Vite frontend for real-time simulation and analytics visualization. 
- **Data Layer**: In-memory caching and dataset loading.
- **Orchestration**: `MessagePipeline` manages the lifecycle of a message through context building, AI evaluation, and calibration.
- **Presentation**: Express + Vite serving a React SPA with Tailwind CSS and Framer Motion.

## 6. AI Pipeline
1. **Context Building**: Aggregates user profiles, group metadata, business history, and message metadata.
2. **History Retrieval**: Fetches past interactions, engagement scores, and similar messages to establish a behavioral baseline.
3. **Media Processing**: Extracts text and intent from attached images or voice notes.
4. **LLM Evaluation**: Google Gemini evaluates the full 360-degree context.
5. **Confidence Calibration**: Deterministically adjusts the AI's confidence score based on historical evidence weight.

## 7. Multi-Agent Workflow
- **Router Agent (Primary)**: Makes the initial routing decision based on the injected context.
- **Reflection Agent (Critic)**: Reviews the Router's decision, looking for missed nuances (e.g., subtle urgency or hidden spam). If a discrepancy is found, it overrides the initial decision with a higher-tier model.
- **Calibrator**: Finalizes the output, ensuring strict adherence to the schema and formatting rules.

## 8. Folder Structure
```text
.
├── dataset/                  # Hackathon CSV datasets
├── dist/                     # Compiled frontend/backend assets
├── src/                      # Frontend React Application
│   ├── components/           # Reusable UI components (Simulator, Dashboard, etc.)
│   ├── pages/                # App views
│   ├── services/             # API integration
│   └── ...
├── main.py                   # Main backend pipeline entry point
├── output_generator.py       # Validates and writes output.csv
├── router_agent.py           # Primary routing LLM logic
├── reflection_agent.py       # Critic LLM logic
├── gemini_client.py          # Wrapper for Google GenAI SDK
├── schemas.py                # Pydantic data models
├── server.ts                 # Express API and Vite middleware
└── ...
```

## 9. Technologies Used
- **Backend Core**: Python 3.11, Pandas, Asyncio
- **AI/LLM**: Google Gemini API (`@google/genai`, `google-genai`), Pydantic, Jinja2
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide React
- **Server**: Node.js, Express, ESBuild

## 10. Installation
### Prerequisites
- Node.js (v18+)
- Python (3.11+)

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ai-notification-router
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## 11. Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 12. Running the Project
### Development Mode (Frontend + API)
Run the full-stack development server (Express API + Vite HMR):
```bash
npm run dev
```
Access the dashboard at `http://localhost:3000`.

### Batch Processing Mode (Backend)
Run the AI pipeline to process the datasets and generate `output.csv`:
```bash
python main.py
```

## 13. API Endpoints
- `GET /api/health`: Check server status.
- `GET /api/simulation/analytics`: Retrieve real-time pipeline analytics.
- `GET /api/simulation/scenarios`: Fetch a list of interactive message scenarios for the simulator.

## 14. Evaluation Methodology
Decisions are evaluated on:
1. **Accuracy**: Did the message get routed correctly (Notify/Digest/Mute)?
2. **Context Usage**: Did the AI correctly leverage historical and multimodal context?
3. **Reasoning**: Is the explanation concise and logical?
4. **Confidence**: Is the confidence score appropriately calibrated (e.g., lowered if evidence is lacking)?

## 15. Output Format
The pipeline generates an `output.csv` matching the strict hackathon requirements:
```csv
message_id,action,message_type,reason,confidence,evidence_message_ids
msg_023,digest,business_update,"Standard business or promotional update.",0.92,none
msg_091,notify,urgent,"Urgent action required based on keywords.",0.96,none
```

## 16. Screenshots (placeholder)
*(Insert screenshots of the Dashboard, Phone Simulator, and Pipeline Flow here)*

## 17. Future Improvements
- **Local LLM Fallback**: Implement a lightweight local model for offline processing of highly sensitive personal messages.
- **User Feedback Loop**: Allow users to correct misclassified notifications via the UI to continuously fine-tune the agents.
- **Expanded Multimodal Support**: Add support for parsing video attachments and PDF documents.

## 18. Team Members (placeholder)
- **[Vivek Kumar Singh]** - Ai Developer

## 19. License
Distributed under the MIT License. See `LICENSE` for more information.
