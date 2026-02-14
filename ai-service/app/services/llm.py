"""
LLM service using Ollama for query processing and response generation
"""

import ollama
from typing import Dict, Any, List
from loguru import logger

from app.config import settings


class LLMService:
    """LLM service for natural language processing"""
    
    def __init__(self):
        self.client = ollama.Client(host=settings.OLLAMA_HOST)
        self.model = settings.LLM_MODEL
    
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
                prompt=full_prompt,
                options={
                    'temperature': temperature,
                    'num_predict': max_tokens
                }
            )
            
            return response['response']
            
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return "I apologize, but I encountered an error processing your request."
    
    async def decompose_query(self, query: str) -> Dict[str, Any]:
        """Decompose natural language query into structured components"""
        
        prompt = f"""Analyze this forensic investigation query and extract key components.

Query: "{query}"

Extract and return in this exact JSON format:
{{
    "intent": "search|filter|analyze|summarize",
    "entities": ["list of entities mentioned like phone numbers, names, dates"],
    "filters": {{
        "date_from": "YYYY-MM-DD or null",
        "date_to": "YYYY-MM-DD or null",
        "source_type": "sms|whatsapp|telegram|call_log|contacts or null",
        "phone_number": "phone number or null"
    }},
    "keywords": ["important keywords for search"],
    "semantic_query": "rephrased query for semantic search"
}}

Return ONLY the JSON, no explanation."""

        try:
            response = await self.generate_response(prompt, temperature=0.3)
            # Parse JSON from response
            import json
            # Extract JSON from response (handle markdown code blocks)
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()
            else:
                json_str = response.strip()
            
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
            # We have current evidence - prioritize it
            prompt = f"""You are an Expert Forensic Analyst and Criminal Profiler. Your task is to analyze case data for hidden meanings, coded language, and suspicious connections.

Current Evidence:
{context}

Previous Conversation (for context only):
{conversation_context}

Current Query: {query}

Instructions:
1. **Detect Coded Language**: Scrutinize "normal-looking" chats for slang, euphemisms, or unnatural phrasing that may mask illegal activities (e.g., "food", "groceries", "papers" used in suspicious contexts).
2. **Correlate Events**: Actively link chat messages with financial transactions or other events based on timing and context. Look for patterns like a "delivery" chat followed immediately by a payment.
3. **Identify Intent**: Look beyond the literal meaning. Assess whether casual conversations are facilitating illicit trafficking, money laundering, or coordination.
4. **Cite Evidence**: Support every claim by citing specific [Evidence #X] items.
5. **Be Assertive yet Objective**: State clearly if a conversation appears suspicious, explaining *why* based on the correlations.

Answer:"""
        else:
            # No current evidence - be explicit about this
            prompt = f"""You are a forensic investigation assistant. The query is asking about current case data, but no relevant evidence was found in the case database.

Previous Conversation:
{conversation_context}

Current Query: {query}

Instructions:
1. Clearly state that no relevant current evidence was found in the case data
2. If previous conversation contains relevant information, mention it explicitly as "previously found" or "from earlier analysis"
3. Do not present previous findings as current case data
4. Suggest what kind of evidence might be needed or why it wasn't found

Answer:"""

        try:
            answer = await self.generate_response(prompt, temperature=0.5)
            
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
