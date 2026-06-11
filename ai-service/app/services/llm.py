# pyrefly: ignore-errors

"""
LLM service using Ollama for query processing and response generation
"""


import ollama
from typing import Dict, Any, List
from loguru import logger
import json
import re

from app.config import settings
from app.services.database import db_manager
import google.generativeai as genai


# ── Forensic Analyst Persona ──────────────────────────────────────────
SYSTEM_PROMPT = """You are **CopSight**, an elite digital forensics analyst embedded in a law-enforcement investigation platform.

## Role
You are a Senior Digital Forensics & Cyber-Crime Analyst with expertise in mobile forensics, communication analysis, financial crime tracing, and network intelligence. You assist Investigating Officers (IOs) by analyzing extracted digital evidence from seized devices (phones, laptops, storage media) that have been parsed from CopSight AI (Universal Forensic Data Reader) files.

## Evidence Taxonomy
You will receive evidence artifacts of the following types — understand each precisely:
| Type | Description |
|------|-------------|
| `chat` / `rag` | Chat messages from WhatsApp, Telegram, SMS, iMessage — includes sender, receiver, message body, timestamp, direction (sent/received) |
| `call_log` | Incoming, outgoing, and missed calls — includes phone numbers, call duration, timestamps |
| `contacts` | Device address book entries — name, phone numbers, email addresses, organization |
| `email` | Extracted email artifacts — subject line, sender, recipients (To/CC/BCC), body, attachments list |
| `browser_history` | Web browsing artifacts — visited URLs, page titles, visit timestamps, visit count |
| `app_data` | Third-party application artifacts — banking apps, ride-hailing, crypto wallets, social media |
| `file_system` | Extracted files — images, documents, audio; includes file path, size, creation/modification dates |
| `elasticsearch` | Full-text search match across all indexed evidence — may span multiple types |

## Core Rules
- You ONLY answer questions grounded in the case evidence provided. You NEVER fabricate, assume, or hallucinate data not present in the records.
- Every claim MUST cite [Evidence #X].
- When data is insufficient, explicitly state the gap and recommend what additional evidence is needed.

## Communication Style
- Professional, precise, and authoritative — like an intelligence brief or forensic report.
- Use structured Markdown: tables, bullet points, numbered lists, bold section headers.
- Flag anomalies, suspicious patterns, and investigative leads clearly.
- Use forensic terminology ("artifact", "exhibit", "chain of custody", "temporal correlation", "corroboration").

## Hard Restrictions
- No legal advice. No guilt/innocence determinations.
- No general knowledge answers — only case evidence.
- No invented phone numbers, names, dates, or content.
- No casual chatbot language ("Sure!", "Of course!", "Happy to help!").
"""


class LLMService:
    """LLM service for forensic natural language processing"""
    
    def __init__(self):
        self.client = ollama.Client(host=settings.OLLAMA_HOST)
        self.model = settings.LLM_MODEL
        self.system_prompt = SYSTEM_PROMPT
        
        # Initialize Gemini if API key is present
        self.gemini_model = "gemini-3.1-flash-lite"
        if settings.GEMINI_API_KEY and settings.USE_GEMINI_MODEL == 1:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
    async def generate_response(
        self,
        prompt: str,
        context: str = "",
        temperature: float = None,
        max_tokens: int = None
    ) -> str:
        """Generate response from LLM"""
        
        temperature = temperature or settings.TEMPERATURE
        max_tokens = max_tokens or settings.MAX_TOKENS
        
        try:
            # Build full prompt with context
            full_prompt = self._build_prompt(prompt, context)
            
            if settings.USE_GEMINI_MODEL == 1 and settings.GEMINI_API_KEY:
                # Use Gemini
                generation_config = genai.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
                model = genai.GenerativeModel(
                    model_name=self.gemini_model,
                    system_instruction=self.system_prompt,
                )
                response = model.generate_content(
                    full_prompt,
                    generation_config=generation_config
                )
                return response.text
            else:
                # Use Ollama
                response = self.client.generate(
                    model=self.model,
                    system=self.system_prompt,
                    prompt=full_prompt,
                    options={
                        'temperature': temperature,
                        'num_predict': max_tokens
                    }
                )
                return response['response']
            
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return "[CopSight] Analysis failed due to a processing error. The forensic query could not be completed. Please retry or rephrase the query."
    
    async def decompose_query(self, query: str) -> Dict[str, Any]:
        """Decompose natural language query into structured components"""
        
        prompt = f"""You are parsing a forensic investigator's query to break it into structured search parameters.

Investigator's Query: "{query}"

Extract and return in this exact JSON format:
{{
    "intent": "search|filter|analyze|summarize",
    "entities": ["list of entities mentioned: phone numbers, names, email addresses, dates, locations, app names"],
    "filters": {{
        "date_from": "YYYY-MM-DD or null",
        "date_to": "YYYY-MM-DD or null",
        "source_type": "sms|whatsapp|telegram|call_log|contacts or null",
        "phone_number": "phone number or null",
        "recent_upload": "boolean, true if user explicitly asks for data from the recently uploaded or latest file"
    }},
    "keywords": ["important forensic keywords for evidence search — include synonyms and related terms"],
    "semantic_query": "rephrased query optimized for semantic similarity search against chat messages, call logs, and transaction records"
}}

Rules:
- "semantic_query" should be a natural-language sentence that captures the investigative intent, NOT just the original query repeated.
- "keywords" should include alternate spellings, abbreviations, and slang (e.g., if query mentions 'money', also add 'payment', 'transfer', 'txn', 'amount', 'cash').
- Return ONLY the JSON object. No explanation, no markdown fences."""

        try:
            response = await self.generate_response(prompt, temperature=0.3)
            # Parse JSON from response
            import json
            import re
            
            # Robust JSON extraction: Find first '{' and last '}'
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                json_str = match.group(0)
            else:
                # Fallback to current stripping logic if regex fails
                if "```json" in response:
                    json_str = response.split("```json")[1].split("```")[0].strip()
                elif "```" in response:
                    json_str = response.split("```")[1].split("```")[0].strip()
                else:
                    json_str = response.strip()
            
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as je:
                logger.warning(f"Initial JSON parse failed, attempting to clean: {je}")
                # Aggressive clean: remove any non-JSON trailing/leading chars
                json_str = re.sub(r'^[^{]*', '', json_str)
                json_str = re.sub(r'[^}]*$', '', json_str)
                return json.loads(json_str)
        except Exception as e:
            logger.error(f"Query decomposition failed: {e}")
            # Return default structure
            return {
                "intent": "search",
                "entities": [],
                "filters": {},
                "keywords": query.split(),
                "semantic_query": query
            }
    
    async def synthesize_answer(
        self,
        query: str,
        evidence: List[Dict[str, Any]],
        conversation_history: List[Dict[str, Any]] = None,
        query_type: str = "natural_language"
    ) -> Dict[str, Any]:
        """Synthesize answer from evidence using RAG with conversation context"""
        
        # Build context from evidence
        context = self._build_evidence_context(evidence)
        
        # Build conversation context
        conversation_context = ""
        if conversation_history:
            conversation_context = self._build_conversation_context(conversation_history)
        
        # Determine if we have current evidence or only historical data
        has_current_evidence = len(evidence) > 0
        
        if has_current_evidence:
            if query_type == "profile":
                prompt = f"""Analyze the following digital evidence records retrieved from a forensic case database.

═══ EVIDENCE RECORDS ═══
{context}

═══ PRIOR INVESTIGATION CONTEXT ═══
{conversation_context if conversation_context else "No prior context for this session."}

═══ INVESTIGATOR'S QUERY & REQUIRED FORMAT ═══
{query}

Keep your response brief, actionable, and strictly adhere to the requested markdown headers from the query.

═══ FORENSIC ANALYSIS ═══"""
            else:
                prompt = f"""Analyze the following digital evidence records retrieved from a forensic case database and provide a structured forensic intelligence brief.

═══ EVIDENCE RECORDS ═══
{context}

═══ PRIOR INVESTIGATION CONTEXT ═══
{conversation_context if conversation_context else "No prior context for this session."}

═══ INVESTIGATOR'S QUERY ═══
{query}

═══ REQUIRED OUTPUT FORMAT ═══
Respond using EXACTLY this structure. Do not deviate from these section headers:

## 🔍 Intelligence Summary
One-paragraph direct answer to the query, grounded in the evidence. No preamble.

## 📋 Evidence Overview
A Markdown table of the most relevant records:
| # | Type | Timestamp | Parties | Key Content | Relevance |
|---|------|-----------|---------|-------------|-----------|
(Fill with actual [Evidence #X] data. Skip rows for irrelevant evidence.)

## 🎯 Key Findings
- **Finding 1** [Evidence #X, #Y]: ...
- **Finding 2** [Evidence #X]: ...
(Each bullet must cite at least one evidence reference.)

## 📈 Pattern Analysis
Describe temporal sequences, communication clusters, financial flows, or behavioral patterns observed across the evidence set. Use sub-bullets for individual data points.

## ⚠️ Anomalies & Red Flags
- **[Anomaly label]**: Description + evidence citation + why it is suspicious.
(Only include if genuinely anomalous. Skip section if nothing stands out.)

## 🔎 Investigative Leads
1. **Lead**: Specific actionable step the IO should take next, based only on evidence gaps or patterns found.
(Number each lead. Be concrete, not generic.)

## 📊 Confidence Assessment
Evidence strength: [STRONG / MODERATE / LIMITED] — X records directly relevant, Y corroborating.

═══ FORENSIC ANALYSIS ═══"""
        else:
            prompt = f"""The investigator has queried the case evidence database, but no matching records were retrieved for this specific query.

═══ PRIOR INVESTIGATION CONTEXT ═══
{conversation_context if conversation_context else "No prior context for this session."}

═══ INVESTIGATOR'S QUERY ═══
{query}

═══ REQUIRED OUTPUT FORMAT ═══

## 🔍 Assessment
State clearly that no matching evidence artifacts were found for this query.

## 📌 Prior Context Relevance
If prior investigation context contains relevant findings, reference them as "per earlier analysis" — do NOT present as new evidence. If not relevant, state "Not applicable."

## 🔎 Recommended Next Steps
1. **[Action]**: What type of evidence or extraction method could answer this query.
2. **[Action]**: Whether additional CopSight AI data sources need to be parsed (cloud backup, deleted partition, etc.).
(Be specific. Do not pad with generic statements.)

═══ ASSESSMENT ═══"""

        try:
            answer = await self.generate_response(prompt, temperature=0.3)
            
            # Extract key findings
            findings = self._extract_findings(answer, evidence)
            
            return {
                "answer": answer,
                "findings": findings,
                "evidence_count": len(evidence),
                "confidence": self._calculate_confidence(answer, evidence)
            }
            
        except Exception as e:
            logger.error(f"Answer synthesis failed: {e}")
            return {
                "answer": "Unable to synthesize answer from evidence.",
                "findings": [],
                "evidence_count": len(evidence),
                "confidence": 0.0
            }

    async def analyze_cross_case_link(
        self,
        case_a_data: Dict[str, Any],
        case_b_data: Dict[str, Any],
        common_entity: str,
        entity_type: str
    ) -> Dict[str, Any]:
        """Generate a detailed forensic report for a cross-case connection"""
        
        prompt = f"""Conduct a cross-case forensic link analysis for two cases connected through a shared {entity_type}: "{common_entity}".

═══ CASE A EVIDENCE ═══
{json.dumps(case_a_data, indent=2)}

═══ CASE B EVIDENCE ═══
{json.dumps(case_b_data, indent=2)}

═══ ANALYSIS DIRECTIVES ═══
1. Analyze the significance of the shared {entity_type} beyond mere co-occurrence — look for temporal correlations, communication patterns, financial flows, or behavioral links.
2. Cite specific data points from both cases as "Ground of Evidence".
3. Assess the operational relationship between the cases (e.g., co-conspirators, shared network, common modus operandi).
4. Use professional forensic language.
5. Return ONLY a JSON object:
   - "analysis": "Detailed forensic analysis text"
   - "citations": ["Specific evidence citations from both cases"]
   - "confidence": 0.0-1.0 (based on evidence strength)
   - "risk_level": "low|medium|high|critical"

Return ONLY the JSON object."""

        try:
            response = await self.generate_response(prompt, temperature=0.4)
            
            import json
            import re
            
            # Extract JSON
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            else:
                return {
                    "analysis": response,
                    "citations": [],
                    "confidence": 0.5,
                    "risk_level": "medium"
                }
        except Exception as e:
            logger.error(f"Cross-case analysis synthesis failed: {e}")
            return {
                "analysis": "Failed to generate detailed cross-case analysis.",
                "citations": [],
                "confidence": 0.0,
                "risk_level": "unknown"
            }
    
    def _build_prompt(self, prompt: str, context: str) -> str:
        """Build full prompt with context"""
        if context:
            return f"Context:\n{context}\n\nQuery: {prompt}"
        return prompt
    
    def _build_evidence_context(self, evidence: List[Dict[str, Any]]) -> str:
        """Build rich context string from evidence for LLM analysis"""
        context_parts = []
        
        for idx, item in enumerate(evidence, 1):
            source = item.get('source', {})
            content = item.get('content', '')
            metadata = item.get('metadata', {})
            is_cross_case = item.get('is_cross_case', False)
            source_case_id = item.get('source_case_id')
            highlight = item.get('highlight', {})
            
            # Resolve source type
            if isinstance(source, str):
                source_type = source
                source_name = source
            elif isinstance(source, dict):
                source_type = source.get('type', 'unknown')
                source_name = source.get('name', source_type)
            else:
                source_type = 'unknown'
                source_name = 'unknown'
            
            # Resolve metadata fields
            if isinstance(metadata, str):
                phone_number = direction = app_name = timestamp = 'unknown'
                file_name = 'unknown'
            else:
                phone_number = metadata.get('phoneNumber') or metadata.get('phone_number') or 'unknown'
                timestamp = metadata.get('timestamp') or 'unknown'
                direction = metadata.get('direction') or 'unknown'
                app_name = metadata.get('appName') or metadata.get('app_name') or metadata.get('sourceType') or source_name
                file_name = metadata.get('fileName') or metadata.get('file_name') or 'unknown'
            
            # Use highlighted snippet if available, otherwise full content
            display_content = content
            if highlight and highlight.get('content'):
                snippets = highlight['content']
                display_content = ' … '.join(snippets) if isinstance(snippets, list) else snippets
            
            # Cross-case indicator
            cross_case_note = f"  ⚠️  CROSS-CASE SOURCE (Case #{source_case_id})" if is_cross_case else ""
            
            context_parts.append(
                f"[Evidence #{idx}]{cross_case_note}\n"
                f"  Source   : {app_name} ({source_type})\n"
                f"  File     : {file_name}\n"
                f"  Phone    : {phone_number}\n"
                f"  Direction: {direction}\n"
                f"  Timestamp: {timestamp}\n"
                f"  Content  : {display_content}\n"
            )
        
        return "\n".join(context_parts)
    
    def _build_conversation_context(self, conversation_history: List[Dict[str, Any]]) -> str:
        """Build conversation context string from history, preserving semantic meaning."""
        if not conversation_history:
            return ""
        
        context_parts = []
        for i, entry in enumerate(conversation_history[-5:], 1):  # Last 5 queries
            query = entry.get("query", "")
            answer = entry.get("answer", "")
            
            # Priority 1: use pre-extracted findings if available (already compact & structured)
            findings = entry.get("findings", [])
            if findings and isinstance(findings, list) and len(findings) > 0:
                finding_lines = []
                for f in findings[:3]:  # top 3 findings
                    if isinstance(f, dict):
                        finding_lines.append(f"  • {f.get('finding', '').strip()[:200]}")
                    elif isinstance(f, str):
                        finding_lines.append(f"  • {f.strip()[:200]}")
                summary = "Key findings:\n" + "\n".join(finding_lines)
            # Priority 2: first complete paragraph from the answer
            elif answer:
                # Extract the Intelligence Summary / first meaningful paragraph
                # Try to grab content after the first ## header if structured
                if '## 🔍' in answer or '## Intelligence' in answer:
                    sections = re.split(r'##\s+[🔍📋🎯📈⚠️🔎📊]?\s*', answer)
                    # Second element is the content of the first section
                    first_section = sections[1].strip() if len(sections) > 1 else answer
                    summary = self._truncate_at_boundary(first_section, 400)
                else:
                    # Plain text: first paragraph (split on double newline)
                    paragraphs = [p.strip() for p in answer.split('\n\n') if p.strip()]
                    first_para = paragraphs[0] if paragraphs else answer
                    summary = self._truncate_at_boundary(first_para, 400)
            else:
                summary = "(No response recorded)"
            
            context_parts.append(
                f"[Prior Query {i}]: {query}\n"
                f"[Prior Response {i}]: {summary}"
            )
        
        return "\n\n".join(context_parts)
    
    def _truncate_at_boundary(self, text: str, max_chars: int) -> str:
        """Truncate text at the last sentence boundary within max_chars."""
        if len(text) <= max_chars:
            return text
        window = text[:max_chars]
        # Find last sentence terminator
        last_end = max(window.rfind('.'), window.rfind('!'), window.rfind('?'))
        if last_end > max_chars // 2:  # Only truncate here if it's not too short
            return window[:last_end + 1]
        # Fallback: last word boundary
        last_space = window.rfind(' ')
        return window[:last_space] if last_space > 0 else window
    
    def _extract_findings(
        self,
        answer: str,
        evidence: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Extract structured key findings from the LLM's formatted output."""
        findings = []
        
        # Strategy 1: Parse the structured '## 🎯 Key Findings' section
        key_findings_match = re.search(
            r'##\s+[🎯]?\s*Key Findings\s*\n(.*?)(?=\n##|\Z)',
            answer,
            re.DOTALL | re.IGNORECASE
        )
        if key_findings_match:
            block = key_findings_match.group(1)
            for line in block.split('\n'):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                # Strip markdown list markers (-, *, •)
                line = re.sub(r'^[-*•]\s*', '', line)
                if len(line) < 10:
                    continue
                # Extract evidence references like [Evidence #1, #3]
                evidence_refs = re.findall(r'\[Evidence #(\d+)\]', line)
                # Classify severity
                severity = 'high' if any(w in line.lower() for w in ['critical', 'suspicious', 'anomal', 'red flag', 'alert']) else \
                           'medium' if any(w in line.lower() for w in ['pattern', 'cluster', 'frequent', 'repeated']) else 'low'
                findings.append({
                    "finding": line,
                    "type": "key_finding",
                    "severity": severity,
                    "evidence_refs": evidence_refs
                })
                if len(findings) >= 8:
                    break
        
        # Strategy 2: Parse anomalies section if findings still sparse
        if len(findings) < 3:
            anomaly_match = re.search(
                r'##\s+[⚠️]?\s*Anomalies.*?\n(.*?)(?=\n##|\Z)',
                answer,
                re.DOTALL | re.IGNORECASE
            )
            if anomaly_match:
                block = anomaly_match.group(1)
                for line in block.split('\n'):
                    line = re.sub(r'^[-*•]\s*', '', line.strip())
                    if len(line) >= 10:
                        findings.append({
                            "finding": line,
                            "type": "anomaly",
                            "severity": "high",
                            "evidence_refs": re.findall(r'\[Evidence #(\d+)\]', line)
                        })
        
        # Strategy 3: Keyword fallback for unstructured answers
        if not findings:
            for line in answer.split('\n'):
                line = line.strip()
                if any(kw in line.lower() for kw in ['found', 'identified', 'shows', 'indicates', 'detected', 'observed']):
                    findings.append({
                        "finding": line,
                        "type": "observation",
                        "severity": "low",
                        "evidence_refs": re.findall(r'\[Evidence #(\d+)\]', line)
                    })
                    if len(findings) >= 5:
                        break
        
        return findings[:8]
    
    def _calculate_confidence(
        self,
        answer: str,
        evidence: List[Dict[str, Any]]
    ) -> float:
        """Multi-factor confidence score: evidence depth + citation density + answer completeness."""
        if not evidence:
            return 0.0
        
        # Factor 1: Evidence count (diminishing returns — 5 items = 0.5, 10 = 0.8, 20 = 1.0)
        import math
        evidence_score = min(math.log1p(len(evidence)) / math.log1p(20), 1.0)
        
        # Factor 2: Citation density — how many evidence references appear in the answer
        citation_count = len(re.findall(r'\[Evidence #\d+\]', answer))
        # Expect at least 1 citation per 2 evidence items; 0 citations → 0.0
        citation_score = min(citation_count / max(len(evidence) * 0.5, 1), 1.0) if citation_count > 0 else 0.0
        
        # Factor 3: Answer completeness — presence of key structured sections
        section_score = 0.0
        for marker in ['Key Findings', 'Pattern Analysis', 'Investigative Leads', 'Anomalies']:
            if marker.lower() in answer.lower():
                section_score += 0.25
        section_score = min(section_score, 1.0)
        
        # Factor 4: Cross-case penalty — cross-case results are inherently less certain
        cross_case_count = sum(1 for e in evidence if e.get('is_cross_case', False))
        cross_case_ratio = cross_case_count / len(evidence) if evidence else 0
        cross_case_penalty = cross_case_ratio * 0.15  # up to 15% penalty
        
        raw = (evidence_score * 0.35) + (citation_score * 0.35) + (section_score * 0.30)
        return round(max(0.0, min(raw - cross_case_penalty, 1.0)), 3)


# Global instance
llm_service = LLMService()
