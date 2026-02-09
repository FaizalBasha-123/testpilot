"""
Embeddings - Vector Store Integration
======================================

This module provides semantic embedding and retrieval for codebase context.
Uses Qdrant for vector storage and OpenAI/Jina for embeddings.

Features:
- Embed code chunks into vectors
- Semantic search for similar code
- Cache embeddings per-repo for efficiency
"""

import os
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

# Lazy imports for optional dependencies
_qdrant_client = None
_embedding_model = None


@dataclass
class CodeChunk:
    """A chunk of code with metadata."""
    file_path: str
    content: str
    start_line: int
    end_line: int
    symbol_name: Optional[str] = None
    language: Optional[str] = None


@dataclass
class SimilarCode:
    """Similar code search result."""
    chunk: CodeChunk
    score: float
    file_path: str


class EmbeddingsService:
    """
    Semantic embeddings for code search.
    
    Uses:
    - Qdrant (in-memory or persistent) for vector storage
    - OpenAI text-embedding-3-small for embeddings ($0.02/1M tokens)
    """
    
    def __init__(
        self,
        collection_name: str = "code_chunks",
        embedding_model: str = "text-embedding-3-small",
        qdrant_url: Optional[str] = None,
        qdrant_api_key: Optional[str] = None,
        use_memory: bool = True
    ):
        """
        Initialize embeddings service.
        
        Args:
            collection_name: Qdrant collection name
            embedding_model: OpenAI embedding model
            qdrant_url: Qdrant server URL (None = in-memory)
            qdrant_api_key: Qdrant API key
            use_memory: Use in-memory Qdrant (faster for dev)
        """
        self.collection_name = collection_name
        self.embedding_model = embedding_model
        self.qdrant_url = qdrant_url or os.environ.get("QDRANT_URL")
        self.qdrant_api_key = qdrant_api_key or os.environ.get("QDRANT_API_KEY")
        self.use_memory = use_memory
        self._client = None
        self._openai = None
    
    def _init_qdrant(self):
        """Lazy initialize Qdrant client."""
        if self._client is not None:
            return
        
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, VectorParams
        except ImportError:
            raise ImportError("Install qdrant-client: pip install qdrant-client")
        
        if self.use_memory:
            self._client = QdrantClient(":memory:")
        elif self.qdrant_url:
            self._client = QdrantClient(
                url=self.qdrant_url,
                api_key=self.qdrant_api_key
            )
        else:
            # Local file-based storage
            self._client = QdrantClient(path="./qdrant_data")
        
        # Create collection if not exists
        collections = self._client.get_collections().collections
        if not any(c.name == self.collection_name for c in collections):
            self._client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
            )
    
    def _init_openai(self):
        """Lazy initialize OpenAI client."""
        if self._openai is not None:
            return
        
        try:
            import openai
        except ImportError:
            raise ImportError("Install openai: pip install openai")
        
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable required")
        
        self._openai = openai.OpenAI(api_key=api_key)
    
    def _embed(self, text: str) -> List[float]:
        """Get embedding for text."""
        self._init_openai()
        
        response = self._openai.embeddings.create(
            model=self.embedding_model,
            input=text[:8000]  # Truncate to model limit
        )
        return response.data[0].embedding
    
    def _chunk_id(self, chunk: CodeChunk) -> str:
        """Generate unique ID for chunk."""
        content = f"{chunk.file_path}:{chunk.start_line}:{chunk.content}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def index_chunks(self, chunks: List[CodeChunk], repo_id: str = "default") -> int:
        """
        Index code chunks into vector store.
        
        Args:
            chunks: List of code chunks to index
            repo_id: Repository identifier for namespacing
        
        Returns:
            Number of chunks indexed
        """
        self._init_qdrant()
        
        from qdrant_client.models import PointStruct
        
        points = []
        for chunk in chunks:
            embedding = self._embed(chunk.content)
            point_id = self._chunk_id(chunk)
            
            points.append(PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "file_path": chunk.file_path,
                    "content": chunk.content,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "symbol_name": chunk.symbol_name,
                    "language": chunk.language,
                    "repo_id": repo_id
                }
            ))
        
        if points:
            self._client.upsert(
                collection_name=self.collection_name,
                points=points
            )
        
        return len(points)
    
    def search_similar(
        self,
        query: str,
        repo_id: str = "default",
        top_k: int = 5,
        min_score: float = 0.7
    ) -> List[SimilarCode]:
        """
        Search for similar code.
        
        Args:
            query: Code or text to search for
            repo_id: Repository to search in
            top_k: Number of results
            min_score: Minimum similarity score (0-1)
        
        Returns:
            List of similar code chunks with scores
        """
        self._init_qdrant()
        
        query_embedding = self._embed(query)
        
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        
        results = self._client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding,
            query_filter=Filter(
                must=[FieldCondition(key="repo_id", match=MatchValue(value=repo_id))]
            ),
            limit=top_k
        )
        
        similar = []
        for result in results:
            if result.score < min_score:
                continue
            
            payload = result.payload
            chunk = CodeChunk(
                file_path=payload["file_path"],
                content=payload["content"],
                start_line=payload["start_line"],
                end_line=payload["end_line"],
                symbol_name=payload.get("symbol_name"),
                language=payload.get("language")
            )
            similar.append(SimilarCode(
                chunk=chunk,
                score=result.score,
                file_path=payload["file_path"]
            ))
        
        return similar
    
    def delete_repo(self, repo_id: str) -> int:
        """Delete all chunks for a repository."""
        self._init_qdrant()
        
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        
        result = self._client.delete(
            collection_name=self.collection_name,
            points_selector=Filter(
                must=[FieldCondition(key="repo_id", match=MatchValue(value=repo_id))]
            )
        )
        return result.status


# ============================================================================
# Convenience Functions
# ============================================================================

_service: Optional[EmbeddingsService] = None

def get_embeddings_service() -> EmbeddingsService:
    """Get singleton embeddings service."""
    global _service
    if _service is None:
        _service = EmbeddingsService()
    return _service


def index_file(file_path: str, content: str, repo_id: str = "default") -> int:
    """
    Index a single file by splitting into function-level chunks.
    
    Args:
        file_path: Path to file
        content: File content
        repo_id: Repository ID
    
    Returns:
        Number of chunks indexed
    """
    # Simple chunking by splitting on function definitions
    # For production, use tree-sitter from code_graph.py
    chunks = []
    lines = content.split("\n")
    
    # Simple heuristic: chunk by consecutive non-empty lines
    current_chunk = []
    start_line = 1
    
    for i, line in enumerate(lines, 1):
        if line.strip():
            current_chunk.append(line)
        elif current_chunk:
            chunks.append(CodeChunk(
                file_path=file_path,
                content="\n".join(current_chunk),
                start_line=start_line,
                end_line=i - 1
            ))
            current_chunk = []
            start_line = i + 1
    
    if current_chunk:
        chunks.append(CodeChunk(
            file_path=file_path,
            content="\n".join(current_chunk),
            start_line=start_line,
            end_line=len(lines)
        ))
    
    service = get_embeddings_service()
    return service.index_chunks(chunks, repo_id)


def find_similar_code(query: str, repo_id: str = "default", top_k: int = 5) -> List[Dict]:
    """
    Find similar code to query.
    
    Args:
        query: Code or description
        repo_id: Repository to search
        top_k: Number of results
    
    Returns:
        List of dicts with file_path, content, score
    """
    service = get_embeddings_service()
    results = service.search_similar(query, repo_id, top_k)
    
    return [
        {
            "file_path": r.file_path,
            "content": r.chunk.content,
            "start_line": r.chunk.start_line,
            "end_line": r.chunk.end_line,
            "score": r.score
        }
        for r in results
    ]
