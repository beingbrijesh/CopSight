from langchain.chat_models import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.prompts import ChatPromptTemplate
import openai
from typing import List, Dict, Any, Optional
import time
import json
import re

from vector_store import VectorStore

class RAGEngine:
    def __init__(self, vector_store: VectorStore, openai_api_key: str):
        self.vector_store = vector_store
        self.llm = ChatOpenAI(
            openai_api_key=openai_api_key,
            model_name="gpt-4",
            temperature=0.1
        )
        openai.api_key = openai_api_key
    
    async def search(self, query: str, filters: Optional[Dict[str, Any]] = None, top_k: int = 10, include_context: bool = True) -> Dict[str, Any]:
        """Perform RAG-based search"""
        
        start_time = time.time()
        
        try:
            # Step 1: Retrieve relevant documents from vector store
            search_results = await self.vector_store.search_similar(
                query=query,
                collection_name="ufdr_messages",
                top_k=top_k,
                filters=filters
            )
            
            # Step 2: Prepare context from retrieved documents
            context_documents = []
            for i, doc in enumerate(search_results["documents"]):
                metadata = search_results["metadatas"][i] if i < len(search_results["metadatas"]) else {}
                context_documents.append({
                    "content": doc,
                    "metadata": metadata,
                    "similarity_score": 1 - search_results["distances"][i] if i < len(search_results["distances"]) else 0
                })
            
            # Step 3: Generate answer using LLM
            if include_context and context_documents:
                answer = await self._generate_contextual_answer(query, context_documents)
                confidence_score = self._calculate_confidence_score(context_documents)
            else:
                answer = await self._generate_direct_answer(query)
                confidence_score = 0.5
            
            processing_time = time.time() - start_time
            
            return {
                "answer": answer,
                "sources": context_documents,
                "confidence_score": confidence_score,
                "total_results": len(context_documents),
                "processing_time": processing_time
            }
            
        except Exception as e:
            return {
                "answer": f"I encountered an error while processing your query: {str(e)}",
                "sources": [],
                "confidence_score": 0.0,
                "total_results": 0,
                "processing_time": time.time() - start_time
            }
    
    async def _generate_contextual_answer(self, query: str, context_documents: List[Dict[str, Any]]) -> str:
        """Generate answer using retrieved context"""
        
        # Prepare context string
        context_text = ""
        for i, doc in enumerate(context_documents[:5]):  # Use top 5 documents
            metadata = doc["metadata"]
            sender = metadata.get("sender_id", "Unknown")
            receiver = metadata.get("receiver_id", "Unknown")
            timestamp = metadata.get("timestamp", "Unknown")
            app_name = metadata.get("app_name", "Unknown")
            
            context_text += f"""
Document {i+1}:
App: {app_name}
From: {sender} To: {receiver}
Time: {timestamp}
Content: {doc["content"]}
Relevance Score: {doc["similarity_score"]:.3f}

"""
        
        # Create prompt
        system_prompt = """You are an AI assistant specialized in analyzing digital forensic data from mobile devices. 
Your role is to help investigators understand communication patterns, relationships, and extract insights from messages, calls, and contacts.

When answering questions:
1. Be precise and factual
2. Cite specific evidence from the provided context
3. Highlight important patterns or anomalies
4. Maintain investigative objectivity
5. If information is insufficient, clearly state limitations

Context Documents:
{context}

User Query: {query}

Provide a comprehensive answer based on the available evidence."""

        try:
            messages = [
                SystemMessage(content=system_prompt.format(context=context_text, query=query)),
                HumanMessage(content=query)
            ]
            
            response = self.llm(messages)
            return response.content
            
        except Exception as e:
            return f"Error generating contextual answer: {str(e)}"
    
    async def _generate_direct_answer(self, query: str) -> str:
        """Generate direct answer without context"""
        
        system_prompt = """You are an AI assistant specialized in digital forensics. 
Provide helpful guidance about digital forensic analysis, mobile device investigation techniques, 
and communication pattern analysis. If you cannot answer based on general knowledge, 
suggest what type of data or analysis would be needed."""
        
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=query)
            ]
            
            response = self.llm(messages)
            return response.content
            
        except Exception as e:
            return f"Error generating answer: {str(e)}"
    
    def _calculate_confidence_score(self, context_documents: List[Dict[str, Any]]) -> float:
        """Calculate confidence score based on retrieved documents"""
        
        if not context_documents:
            return 0.0
        
        # Base confidence on similarity scores and number of relevant documents
        avg_similarity = sum(doc["similarity_score"] for doc in context_documents) / len(context_documents)
        doc_count_factor = min(len(context_documents) / 5, 1.0)  # Normalize to max 5 docs
        
        confidence = (avg_similarity * 0.7) + (doc_count_factor * 0.3)
        return min(confidence, 1.0)
    
    async def analyze_sentiment(self, texts: List[str]) -> List[Dict[str, Any]]:
        """Analyze sentiment of text messages"""
        
        sentiments = []
        
        for text in texts:
            try:
                prompt = f"""Analyze the sentiment of this message and categorize it as positive, negative, or neutral. 
Also provide a confidence score (0-1) and brief reasoning.

Message: "{text}"

Respond in JSON format:
{{
    "sentiment": "positive|negative|neutral",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
}}"""
                
                messages = [HumanMessage(content=prompt)]
                response = self.llm(messages)
                
                # Parse JSON response
                try:
                    sentiment_data = json.loads(response.content)
                    sentiments.append(sentiment_data)
                except json.JSONDecodeError:
                    # Fallback parsing
                    sentiment = "neutral"
                    if "positive" in response.content.lower():
                        sentiment = "positive"
                    elif "negative" in response.content.lower():
                        sentiment = "negative"
                    
                    sentiments.append({
                        "sentiment": sentiment,
                        "confidence": 0.5,
                        "reasoning": "Fallback analysis"
                    })
                
            except Exception as e:
                sentiments.append({
                    "sentiment": "neutral",
                    "confidence": 0.0,
                    "reasoning": f"Error: {str(e)}"
                })
        
        return sentiments
    
    async def extract_entities(self, texts: List[str]) -> List[Dict[str, Any]]:
        """Extract named entities from text"""
        
        entities_list = []
        
        for text in texts:
            try:
                prompt = f"""Extract named entities from this message. Identify:
- PERSON: Names of people
- PHONE: Phone numbers
- EMAIL: Email addresses
- LOCATION: Places, addresses
- ORGANIZATION: Companies, institutions
- DATE: Dates and times
- MONEY: Monetary amounts

Message: "{text}"

Respond in JSON format:
{{
    "entities": [
        {{"type": "PERSON", "text": "John Doe", "start": 0, "end": 8}},
        ...
    ]
}}"""
                
                messages = [HumanMessage(content=prompt)]
                response = self.llm(messages)
                
                # Parse JSON response
                try:
                    entity_data = json.loads(response.content)
                    entities_list.append(entity_data)
                except json.JSONDecodeError:
                    # Fallback: extract phone numbers and emails with regex
                    phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
                    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
                    
                    entities = []
                    
                    # Find phone numbers
                    for match in re.finditer(phone_pattern, text):
                        entities.append({
                            "type": "PHONE",
                            "text": match.group(),
                            "start": match.start(),
                            "end": match.end()
                        })
                    
                    # Find emails
                    for match in re.finditer(email_pattern, text):
                        entities.append({
                            "type": "EMAIL",
                            "text": match.group(),
                            "start": match.start(),
                            "end": match.end()
                        })
                    
                    entities_list.append({"entities": entities})
                
            except Exception as e:
                entities_list.append({
                    "entities": [],
                    "error": str(e)
                })
        
        return entities_list
    
    async def summarize_conversation(self, messages: List[Dict[str, Any]], max_length: int = 200) -> str:
        """Summarize a conversation thread"""
        
        try:
            # Prepare conversation text
            conversation_text = ""
            for msg in messages:
                sender = msg.get("sender_id", "Unknown")
                content = msg.get("content", "")
                timestamp = msg.get("timestamp", "")
                conversation_text += f"[{timestamp}] {sender}: {content}\n"
            
            prompt = f"""Summarize this conversation thread in {max_length} characters or less. 
Focus on key topics, decisions, and important information exchanged.

Conversation:
{conversation_text}

Summary:"""
            
            messages = [HumanMessage(content=prompt)]
            response = self.llm(messages)
            
            summary = response.content.strip()
            
            # Truncate if necessary
            if len(summary) > max_length:
                summary = summary[:max_length-3] + "..."
            
            return summary
            
        except Exception as e:
            return f"Error summarizing conversation: {str(e)}"
    
    async def health_check(self) -> Dict[str, Any]:
        """Check RAG engine health"""
        try:
            # Test LLM connection
            test_messages = [HumanMessage(content="Hello, this is a health check.")]
            response = self.llm(test_messages)
            
            return {
                "status": "healthy",
                "model": "gpt-4",
                "test_response_length": len(response.content)
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
