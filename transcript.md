# AI Usage Transcript: AI Notification Router

This document serves as the official AI Usage Transcript and development log for the **AI Notification Router** hackathon project. It details how Google AI Studio and Gemini models were utilized across the entire software development lifecycle to architect, build, and optimize the solution.

---

## 1. Initial Architecture Design
**Usage:** Concept generation and structural planning.
**Details:** We prompted Gemini to help design a system that combats notification fatigue. Through interactive brainstorming, the AI suggested a multi-agent backend architecture (Router + Reflection agents) coupled with a deterministic calibration layer to ensure safe outputs. Gemini also proposed the full-stack structure (Python backend for batch processing, React/Vite for a real-time simulation dashboard).

## 2. Backend Module Generation
**Usage:** Scaffolding the Python backend.
**Details:** Gemini was used to generate robust object-oriented Python modules. It authored strict data models using Pydantic (`schemas.py`), defining schemas for `CalibratedDecision`, `MessageContext`, and multimodal structures to ensure data integrity across the pipeline.

## 3. Prompt Engineering
**Usage:** Designing contextual AI instructions.
**Details:** We collaborated with Gemini to write highly specific system and user prompts (using Jinja2 templating). We iterated on the instructions to teach the model how to differentiate between urgent business updates, spam, and personal notifications, effectively embedding complex routing heuristics into the LLM context.

## 4. Gemini API Integration
**Usage:** Implementing the `google-genai` SDK.
**Details:** The AI generated the `gemini_client.py` wrapper, providing production-ready asynchronous calls to the Gemini models (`gemini-2.5-pro` and `gemini-2.5-flash`). It included advanced features like `UsageMetadata` tracking, structured JSON outputs, and custom exception handling (e.g., `CircuitBreakerTrippedError` for rate limits).

## 5. Context Builder
**Usage:** Synthesizing relational data.
**Details:** We tasked Gemini with writing Pandas logic to aggregate data across multiple mock CSVs. The `ContextBuilder` module was generated to fuse `UserProfile`, `GroupContext`, and `BusinessContext` into a unified `MessageContext` object, giving the LLM a 360-degree view of every incoming notification.

## 6. History Retrieval
**Usage:** Establishing behavioral baselines.
**Details:** Gemini helped implement the `HistoryRetriever`, a module designed to fetch past interactions (e.g., how often a user ignores a specific sender). The AI generated the aggregation logic that creates the `EngagementSummary`, which strongly influences the router's final decision.

## 7. Media Processing
**Usage:** Multimodal extraction logic.
**Details:** To handle non-text notifications, Gemini wrote the `MediaProcessor`. It utilized Gemini's native multimodal capabilities to analyze images (extracting OCR text, identifying spam/promotions) and voice notes (evaluating tone and urgency), returning structured Pydantic models for the downstream router.

## 8. Router Agent
**Usage:** Core decision-making module.
**Details:** The AI generated the `RouterAgent` class. This primary LLM controller ingests the synthesized context, history, and media analysis to output a strict `RoutingDecision` (Action, Message Type, Reason, and Confidence). 

## 9. Reflection Agent
**Usage:** Implementing self-correction algorithms.
**Details:** To increase accuracy, Gemini helped design a "Critic" workflow. The `ReflectionAgent` takes the Router's initial output and double-checks for missed nuances (e.g., subtle urgency hidden in a casual text). If necessary, it overrides the initial decision, utilizing a heavier model (Pro) for escalation.

## 10. Confidence Calibration
**Usage:** Deterministic safety rails.
**Details:** We asked Gemini to write a deterministic fallback layer. The `ConfidenceCalibrator` adjusts the AI's raw confidence scores based on hard rules (e.g., capping confidence if historical evidence is missing), bridging the gap between probabilistic AI outputs and rigid system requirements.

## 11. Frontend Architecture
**Usage:** Setting up the React SPA environment.
**Details:** Gemini established the Vite/React frontend, creating an integrated Express server (`server.ts`) to serve API routes and manage Vite middleware. It enforced a modular component structure and Tailwind CSS best practices.

## 12. React Components
**Usage:** Building the interactive Dashboard and Simulator.
**Details:** The AI generated responsive, polished UI components using Tailwind CSS and Framer Motion. Key contributions include the `Simulator.tsx` interface, which visualizes the AI pipeline in real-time, and an automated "Presentation Mode" to autonomously cycle through demo scenarios.

## 13. API Integration
**Usage:** Connecting the frontend to backend controllers.
**Details:** Gemini wrote custom React hooks and API utility functions to fetch simulation scenarios and analytics, seamlessly connecting the React interface to the backend logic layer.

## 14. Testing and Debugging
**Usage:** Troubleshooting code and environment issues.
**Details:** Throughout development, Gemini acted as a pair programmer. It resolved `Pydantic` module import errors, fixed asynchronous queue deadlocks in the Python pipeline, and debugged React `useEffect` rendering loops during the Presentation Mode implementation.

## 15. Final Optimization
**Usage:** Scale and compliance.
**Details:** In the final stages, Gemini optimized the `main.py` execution loop by adding concurrency control (`asyncio.gather` with limits) and batching logic to avoid rate-limiting. It also implemented the `OutputGenerator` to enforce strict hackathon schema validation before writing the final `output.csv`.
