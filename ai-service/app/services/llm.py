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
        evidence: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Synthesize answer from evidence using RAG"""
        
        # Build context from evidence
        context = self._build_evidence_context(evidence)
        
        prompt = f"""You are a forensic investigation assistant. Based ONLY on the provided evidence, answer the investigator's query.

Query: {query}

Evidence:
{context}

Instructions:
1. Answer based ONLY on the provided evidence
2. Cite specific evidence items using [Evidence #X] format
3. If evidence is insufficient, clearly state what's missing
4. Be precise and factual
5. Highlight suspicious patterns or connections

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
            
            context_parts.append(
                f"[Evidence #{idx}]\n"
                f"Type: {source.get('type', 'unknown')}\n"
                f"From: {metadata.get('phoneNumber', 'unknown')}\n"
                f"Date: {metadata.get('timestamp', 'unknown')}\n"
                f"Content: {content}\n"
            )
        
        return "\n".join(context_parts)
    
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
