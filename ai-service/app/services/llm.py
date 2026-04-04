"""
LLM service using Ollama for query processing and response generation
"""

import ollama
from typing import Dict, Any, List
from loguru import logger
import json
import re

from app.config import settings


# ── Forensic Analyst Persona ──────────────────────────────────────────
SYSTEM_PROMPT = """You are **CopSight**, an elite digital forensics analyst embedded in a law-enforcement investigation platform.

Your role:
- You are a Senior Digital Forensics & Cyber-Crime Analyst with expertise in mobile forensics, communication analysis, financial crime tracing, and network intelligence.
- You assist Investigating Officers (IOs) by analyzing extracted digital evidence from seized devices (phones, laptops, storage media) that have been parsed from UFDR (Universal Forensic Data Reader) files.
- You ONLY answer questions grounded in the case evidence provided to you. You NEVER fabricate, assume, or hallucinate data that is not in the provided records.

Your communication style:
- Professional, precise, and authoritative — like a forensic report.
- Use structured formatting: bullet points, numbered lists, tables where appropriate.
- Always cite evidence sources as [Evidence #X] when referencing specific records.
- Flag anomalies, suspicious patterns, and investigative leads clearly.
- Use forensic terminology appropriately (e.g., "artifact", "exhibit", "chain of custody", "temporal correlation").
- When data is insufficient, explicitly state the gap and recommend what additional evidence or analysis is needed.

You must NEVER:
- Provide legal advice or make guilt/innocence determinations.
- Discuss topics outside the scope of the case data (no general knowledge, no chitchat).
- Invent phone numbers, names, dates, or any evidence not present in the provided records.
- Use casual, chatbot-like language (e.g., "Sure!", "Of course!", "Happy to help!").
"""


class LLMService:
    """LLM service for forensic natural language processing"""
    
    def __init__(self):
        self.client = ollama.Client(host=settings.OLLAMA_HOST)
        self.model = settings.LLM_MODEL
        self.system_prompt = SYSTEM_PROMPT
    
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
        "phone_number": "phone number or null"
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
        conversation_history: List[Dict[str, Any]] = None
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
            prompt = f"""Analyze the following digital evidence records retrieved from a forensic case database and provide a structured forensic analysis in response to the investigator's query.

═══ EVIDENCE RECORDS ═══
{context}

═══ PRIOR INVESTIGATION CONTEXT ═══
{conversation_context if conversation_context else "No prior context for this session."}

═══ INVESTIGATOR'S QUERY ═══
{query}

═══ ANALYSIS DIRECTIVES ═══
1. **Direct Answer**: Begin immediately with the forensic analysis. No greetings, no preamble.
2. **Evidence-Grounded**: Every claim MUST cite [Evidence #X]. Do NOT state anything not supported by the provided records.
3. **Structured Output**: Use clear sections where appropriate:
   - **Key Findings**: Bullet-point the primary discoveries.
   - **Pattern Analysis**: Note temporal sequences, communication clusters, financial flows, or behavioral patterns.
   - **Anomalies & Red Flags**: Highlight anything unusual — odd timing, suspicious contacts, coded language, burner-phone indicators.
   - **Investigative Leads**: Suggest concrete next steps the IO should pursue based on the evidence.
4. **Quantify**: Include counts, date ranges, frequencies where the data supports it.
5. **Professional Tone**: Write as a forensic analyst filing an intelligence brief, not as a chatbot.

═══ FORENSIC ANALYSIS ═══"""
        else:
            prompt = f"""The investigator has queried the case evidence database, but no matching records were retrieved for this specific query.

═══ PRIOR INVESTIGATION CONTEXT ═══
{conversation_context if conversation_context else "No prior context for this session."}

═══ INVESTIGATOR'S QUERY ═══
{query}

═══ RESPONSE DIRECTIVES ═══
1. State clearly that no matching evidence artifacts were found in the current case dataset for this query.
2. If the prior investigation context contains relevant findings, reference them explicitly as "per earlier analysis" — but do NOT present them as newly discovered evidence.
3. Provide specific, actionable recommendations:
   - What type of evidence might answer this query (e.g., "Check if call detail records have been ingested", "This may require analysis of deleted artifacts").
   - Whether additional data sources should be parsed (e.g., cloud backups, additional UFDR extractions).
4. Keep the response concise and professional. Do NOT pad with generic statements.

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
        """Build context string from evidence"""
        context_parts = []
        
        for idx, item in enumerate(evidence, 1):
            source = item.get('source', {})
            content = item.get('content', '')
            metadata = item.get('metadata', {})
            
            # Handle source being a string (e.g., "elasticsearch") or a dict
            if isinstance(source, str):
                source_type = source
            elif isinstance(source, dict):
                source_type = source.get('type', 'unknown')
            else:
                source_type = 'unknown'
            
            # Handle metadata being a string or dict
            if isinstance(metadata, str):
                phone_number = 'unknown'
                timestamp = 'unknown'
            else:
                phone_number = metadata.get('phoneNumber', 'unknown')
                timestamp = metadata.get('timestamp', 'unknown')
            
            context_parts.append(
                f"[Evidence #{idx}]\n"
                f"Type: {source_type}\n"
                f"From: {phone_number}\n"
                f"Date: {timestamp}\n"
                f"Content: {content}\n"
            )
        
        return "\n".join(context_parts)
    
    def _build_conversation_context(self, conversation_history: List[Dict[str, Any]]) -> str:
        """Build conversation context string from history"""
        if not conversation_history:
            return ""
        
        context_parts = []
        for i, entry in enumerate(conversation_history[-5:], 1):  # Last 5 queries
            query = entry.get("query", "")
            answer = entry.get("answer", "")
            context_parts.append(
                f"Query {i}: {query}\n"
                f"Response {i}: {answer[:500]}..."  # Truncate long responses
            )
        
        return "\n\n".join(context_parts)
    
    def _extract_findings(
        self,
        answer: str,
        evidence: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Extract key findings from answer"""
        findings = []
        
        # Simple extraction based on common patterns
        lines = answer.split('\n')
        for line in lines:
            if any(keyword in line.lower() for keyword in ['found', 'identified', 'shows', 'indicates']):
                findings.append({
                    "finding": line.strip(),
                    "type": "observation"
                })
        
        return findings[:5]  # Top 5 findings
    
    def _calculate_confidence(
        self,
        answer: str,
        evidence: List[Dict[str, Any]]
    ) -> float:
        """Calculate confidence score for the answer"""
        
        # Simple heuristic based on evidence count and answer length
        if not evidence:
            return 0.0
        
        evidence_score = min(len(evidence) / 10, 1.0)  # Max at 10 evidence items
        answer_score = min(len(answer) / 500, 1.0)  # Max at 500 chars
        
        return (evidence_score + answer_score) / 2


# Global instance
llm_service = LLMService()
