# AI Notification Router Pipeline
**7-Minute Hackathon Presentation**

---

## 1. The Problem (1 minute)
- **Notification Fatigue:** Users are bombarded with hundreds of messages daily across personal, group, and business chats.
- **Lost Context:** Standard notification systems treat every message equally, ignoring historical engagement, group dynamics, or urgency.
- **The Consequence:** Important messages get lost in the noise, and users aggressively mute entire apps or groups, degrading the user experience.

---

## 2. Existing Solutions (0.5 minutes)
- **Static Rules:** Keyword-based filtering (e.g., "mute if contains 'promo'") is rigid and easily bypassed.
- **Global Mutes:** Users mute entire groups or businesses, missing genuinely important updates.
- **Basic ML:** Simple classifiers lack the deep reasoning required to understand nuanced context, multimodal content, and historical relationships.

---

## 3. Our Innovation (1 minute)
- **Context-Aware Routing:** We don't just classify text. We build a 360-degree context encompassing user behavior, business verification, and historical engagement.
- **Multi-Agent AI:** We use a dual-agent system (Gemini 2.5 Flash for speed, Gemini 2.5 Pro for reflection) to ensure high accuracy and self-correction.
- **Deterministic Calibration:** We anchor LLM confidence scores using hard heuristics, preventing overconfident hallucinations.
- **Actionable Outcomes:** Every message is routed to `notify` (immediate), `digest` (summarized later), or `mute` (silenced).

---

## 4. Architecture (1 minute)
- **Asynchronous & Scalable:** Built on Python `asyncio` for high-throughput concurrent processing.
- **Type-Safe:** Strict schema enforcement using Pydantic V2 to guarantee valid JSON outputs from the LLMs.
- **Decoupled Prompts:** Jinja2 templates separate prompt engineering from application logic, enabling dynamic few-shot injection.
- **Fail-Fast Data Loading:** Eagerly loads and validates datasets using Pandas to ensure data integrity before processing.

---

## 5. The Pipeline (1.5 minutes)
1.  **Data Hydration:** Aggregate user, group, business, and historical data into a unified `MessageContext`.
2.  **Multimodal Extraction:** Process images and voice notes using Gemini to extract OCR, transcripts, and scam indicators.
3.  **Heuristic Scoring:** Calculate derived features like `trust_score`, `urgency_score`, and `spam_probability`.
4.  **Primary Routing (Flash):** Fast-pass decision making using Gemini 2.5 Flash.
5.  **Reflection (Pro):** Gemini 2.5 Pro critiques the initial decision against the facts to catch logic errors.
6.  **Calibration:** Deterministic rules adjust the final confidence score based on the derived heuristics.

---

## 6. Demo (1 minute)
*(Live or recorded walkthrough)*
- **Scenario 1:** A promotional image from a verified business. Routed to `digest` because the user historically dismisses them.
- **Scenario 2:** An urgent text in a muted group. The system detects high urgency and overrides the group mute to `notify`.
- **Scenario 3:** A voice note with high spam probability. The Reflection agent catches the risk and changes the routing to `mute`.

---

## 7. Results (0.5 minutes)
- **High Accuracy:** Our multi-agent approach significantly improves routing precision compared to single-pass LLM prompts.
- **Calibrated Confidence:** By applying deterministic adjustments, our confidence scores accurately reflect the ambiguity of the message.
- **Robustness:** Pydantic schemas and fallback heuristics ensure the pipeline never breaks or returns invalid JSON.

---

## 8. Challenges (0.5 minutes)
- **LLM Hallucinations:** Initial models sometimes hallucinated evidence or were overly confident. Solved via the Reflection Agent and Confidence Calibrator.
- **Context Window Limits:** Passing entire chat histories is expensive and slow. Solved by extracting engagement summaries and top-K relevant messages.
- **Schema Adherence:** Ensuring strict JSON output from LLMs required careful prompt engineering and Pydantic validation.

---

## 9. Future Scope (0.5 minutes)
- **Semantic Search:** Replace deterministic keyword matching with dense vector embeddings (e.g., `text-embedding-004`) for better historical retrieval.
- **Streaming & Chunking:** Optimize the Pandas data loader to handle massive datasets out-of-memory.
- **Personalized Digestion:** Use LLMs to generate personalized daily summaries instead of just categorizing them.

---

## 10. Likely Judge Questions (Prep)

*   **Q: Why use two agents (Flash and Pro) instead of just one?**
    *   *A: Cost and accuracy. Flash is fast and cheap for the initial pass, while Pro is reserved for deep critique. This hybrid approach gives the best of both worlds.*
*   **Q: How do you prevent the system from muting important alerts?**
    *   *A: Our heuristic engine calculates an `urgency_score`. High urgency (e.g., family member, financial alert) heavily penalizes the `mute` action, and the Reflection agent acts as a safety net.*
*   **Q: How does the Confidence Calibrator work?**
    *   *A: It's a deterministic rule engine. If the LLM says 0.99 confidence but the heuristic `spam_probability` is high, the calibrator mathematically lowers the score to reflect the real-world ambiguity.*
*   **Q: Is this scalable for real-time messaging?**
    *   *A: Yes, the pipeline is fully asynchronous. The primary bottleneck is API latency, which is why we cache media processing and use the faster Flash model for the first pass.*
