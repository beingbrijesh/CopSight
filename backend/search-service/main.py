from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import asyncio

from rag_engine import RAGEngine
from vector_store import VectorStore
from models import SearchRequest, SearchResponse, EmbeddingRequest, EmbeddingResponse
from config import settings

app = FastAPI(title="UFDR AI Search Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
vector_store = VectorStore(settings.CHROMADB_URL)
rag_engine = RAGEngine(vector_store, settings.OPENAI_API_KEY)

@app.post("/search", response_model=SearchResponse)
async def intelligent_search(request: SearchRequest):
    """Perform intelligent search using RAG (Retrieval-Augmented Generation)"""
    
    try:
        # Use RAG engine to process the query
        result = await rag_engine.search(
            query=request.query,
            filters=request.filters,
            top_k=request.top_k,
            include_context=request.include_context
        )
        
        return SearchResponse(
            query=request.query,
            answer=result["answer"],
            sources=result["sources"],
            confidence_score=result["confidence_score"],
            total_results=result["total_results"],
            processing_time=result["processing_time"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """Create embeddings for text data"""
    
    try:
        embeddings = await vector_store.create_embeddings(request.texts)
        
        return EmbeddingResponse(
            embeddings=embeddings,
            model=vector_store.embedding_model_name,
            total_tokens=sum(len(text.split()) for text in request.texts)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding creation failed: {str(e)}")

@app.post("/index_documents")
async def index_documents(documents: List[Dict[str, Any]]):
    """Index documents into the vector store"""
    
    try:
        # Extract text content from documents
        texts = []
        metadatas = []
        ids = []
        
        for i, doc in enumerate(documents):
            if "content" in doc:
                texts.append(doc["content"])
                metadatas.append({k: v for k, v in doc.items() if k != "content"})
                ids.append(doc.get("id", f"doc_{i}"))
        
        # Index documents
        await vector_store.add_documents(texts, metadatas, ids)
        
        return {
            "status": "success",
            "indexed_count": len(texts),
            "message": "Documents indexed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

@app.get("/similar/{document_id}")
async def find_similar_documents(document_id: str, top_k: int = 5):
    """Find similar documents to a given document"""
    
    try:
        similar_docs = await vector_store.find_similar(document_id, top_k)
        return {
            "document_id": document_id,
            "similar_documents": similar_docs
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Similarity search failed: {str(e)}")

@app.post("/analyze_sentiment")
async def analyze_sentiment(texts: List[str]):
    """Analyze sentiment of text messages"""
    
    try:
        sentiments = await rag_engine.analyze_sentiment(texts)
        return {
            "sentiments": sentiments,
            "total_analyzed": len(texts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")

@app.post("/extract_entities")
async def extract_entities(texts: List[str]):
    """Extract named entities from text"""
    
    try:
        entities = await rag_engine.extract_entities(texts)
        return {
            "entities": entities,
            "total_processed": len(texts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Entity extraction failed: {str(e)}")

@app.post("/summarize")
async def summarize_conversations(messages: List[Dict[str, Any]], max_length: int = 200):
    """Summarize conversation threads"""
    
    try:
        summary = await rag_engine.summarize_conversation(messages, max_length)
        return {
            "summary": summary,
            "original_message_count": len(messages),
            "compression_ratio": len(summary) / sum(len(msg.get("content", "")) for msg in messages)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check vector store health
        vector_health = await vector_store.health_check()
        
        # Check RAG engine health
        rag_health = await rag_engine.health_check()
        
        return {
            "status": "healthy",
            "vector_store": vector_health,
            "rag_engine": rag_health,
            "service": "search"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "service": "search"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
