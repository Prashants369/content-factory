"""
Memory Agent — reads and writes per-influencer long-term learnings to SQLite.
The factory database is at: ../data/factory.db
"""
import os
import json
import uuid
import sqlite3
from pathlib import Path
from typing import Optional

import google.generativeai as genai
import numpy as np
import base64


DB_PATH = Path(__file__).parent.parent.parent / "data" / "factory.db"


class MemoryAgent:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        if self.api_key:
            genai.configure(api_key=self.api_key)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn

    def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding using Gemini."""
        if not self.api_key:
            return []
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"[MemoryAgent] Embedding failed: {e}")
            return []

    def get(self, influencer_id: str, memory_type: Optional[str] = None) -> list[dict]:
        with self._conn() as conn:
            if memory_type:
                return [dict(r) for r in conn.execute(
                    "SELECT * FROM influencer_memory WHERE influencer_id = ? AND memory_type = ? ORDER BY importance DESC, created_at DESC LIMIT 50",
                    (influencer_id, memory_type)
                ).fetchall()]
            return [dict(r) for r in conn.execute(
                "SELECT * FROM influencer_memory WHERE influencer_id = ? ORDER BY importance DESC, created_at DESC LIMIT 100",
                (influencer_id,)
            ).fetchall()]

    def search_semantic(self, influencer_id: str, query: str, limit: int = 5, memory_type: Optional[str] = None) -> list[dict]:
        """Search memories using cosine similarity of embeddings, with optional type filtering."""
        query_vec = self._get_embedding(query)
        if not query_vec:
            return self.get(influencer_id, memory_type)[:limit]

        with self._conn() as conn:
            sql = "SELECT * FROM influencer_memory WHERE influencer_id = ? AND embedding_json IS NOT NULL"
            params = [influencer_id]
            if memory_type:
                sql += " AND memory_type = ?"
                params.append(memory_type)
            
            rows = conn.execute(sql, params).fetchall()
            
            memories = [dict(r) for r in rows]
            if not memories:
                return []

            scores = []
            q_vec = np.array(query_vec)
            q_norm = np.linalg.norm(q_vec)
            
            for m in memories:
                m_vec = np.array(json.loads(m["embedding_json"]))
                dot = np.dot(q_vec, m_vec)
                norm = np.linalg.norm(m_vec)
                similarity = dot / (q_norm * norm) if q_norm > 0 and norm > 0 else 0
                scores.append((similarity, m))
            
            scores.sort(key=lambda x: x[0], reverse=True)
            return [hit[1] for hit in scores[:limit]]

    def get_style_context(self, influencer_id: str) -> str:
        """Retrieves high-importance style and visual memories for the Prompt Engineer."""
        memories = self.search_semantic(influencer_id, "visual style lighting camera", limit=3, memory_type="style")
        if not memories:
            return ""
        return " | ".join([m["content"] if isinstance(m["content"], str) else json.dumps(m["content"]) for m in memories])

    def record_success(self, influencer_id: str, prompt: str, visual_feedback: str):
        """Saves a 'Success Pattern' into memory when a render is particularly good."""
        self.save(
            influencer_id=influencer_id,
            memory_type="style",
            content=f"Successful visual pattern: {visual_feedback}. Prompt used: {prompt}",
            importance=0.8
        )

    def get_all(self, limit: int = 200) -> list[dict]:
        """Fetch global memory state for AGI brain rendering."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM influencer_memory ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def save(self, influencer_id: str, memory_type: str, content: dict, importance: float = 0.5):
        embedding = self._get_embedding(json.dumps(content))
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO influencer_memory (id, influencer_id, memory_type, content, importance, embedding_json) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), influencer_id, memory_type, json.dumps(content), importance, json.dumps(embedding) if embedding else None)
            )
            conn.commit()

    def get_credential(self, key: str) -> str:
        """Read an API credential from the factory DB (set by API Vault page)."""
        with self._conn() as conn:
            row = conn.execute(
                "SELECT value FROM api_credentials WHERE key = ?", (key,)
            ).fetchone()
        return row["value"] if row else os.getenv(key, "")

    def sensory_grounding(self, influencer_id: str, image_path: Path, description: str = ""):
        """
        Processes an image using Gemini Vision and saves the insights as a memory.
        """
        if not self.api_key:
            print("[MemoryAgent] API key not configured for sensory grounding.")
            return

        try:
            # Read image as base64
            with open(image_path, "rb") as f:
                image_data = f.read()
                encoded_image = base64.b64encode(image_data).decode("utf-8")

            # Prepare image for Gemini Vision
            image_part = {
                "mime_type": "image/jpeg",  # Assuming JPEG, adjust if needed
                "data": encoded_image
            }

            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt_parts = [
                image_part,
                f"Analyze this image. {description if description else 'What do you see?'}"
            ]
            
            response = model.generate_content(prompt_parts)
            
            # Save the vision response as a memory
            self.save(
                influencer_id=influencer_id,
                memory_type="sensory_grounding",
                content={"image_path": str(image_path), "vision_analysis": response.text},
                importance=0.7 # Assign a default importance
            )
            print(f"[MemoryAgent] Sensory grounding for {image_path} saved.")

        except Exception as e:
            print(f"[MemoryAgent] Sensory grounding failed for {image_path}: {e}")

    async def consolidate(self, influencer_id: str) -> dict:
        """
        REM Sleep Cycle: Prune bad memories and consolidate patterns.
        Returns a summary of the activity.
        """
        stats = {"pruned": 0, "consolidated": 0}
        
        with self._conn() as conn:
            # 1. Prune junk memories
            res = conn.execute(
                "DELETE FROM influencer_memory WHERE influencer_id = ? AND importance < 0.2",
                (influencer_id,)
            )
            stats["pruned"] = res.rowcount
            conn.commit()

            # 2. Extract patterns from mid-importance memories
            rows = conn.execute(
                "SELECT id, content, memory_type FROM influencer_memory WHERE influencer_id = ? AND importance BETWEEN 0.2 AND 0.8",
                (influencer_id,)
            ).fetchall()
            
            if len(rows) < 3:
                return stats # Not enough for consolidation

            # Grouping by type for LLM to see themes
            memories_text = "\n".join([f"- TYPE {r['memory_type']}: {r['content']}" for r in rows])
            
            prompt = f"""
            You are the Memory Consolidation module for an AGI. 
            Below are several fragmented memories from an AI Influencer workflow.
            Extract the core 'Cognitive Pattern' or 'Learning' from these fragments.
            Summarize them into ONE high-level insight that will replace them.
            
            MEMORIES:
            {memories_text}
            
            Format response as JSON: {{"pattern": "...", "confidence": 0.0-1.0}}
            """
            
            try:
                model = genai.GenerativeModel("gemini-1.5-flash")
                response = model.generate_content(prompt)
                pattern_data = json.loads(response.text.strip('`').replace('json\n', ''))
                
                # Save the new consolidated memory
                pattern_id = str(uuid.uuid4())
                embedding = self._get_embedding(pattern_data["pattern"])
                conn.execute(
                    "INSERT INTO influencer_memory (id, influencer_id, memory_type, content, importance, embedding_json) VALUES (?, ?, ?, ?, ?, ?)",
                    (pattern_id, influencer_id, "pattern_consolidation", pattern_data["pattern"], 0.9, json.dumps(embedding) if embedding else None)
                )
                
                # Delete the old fragments
                ids_to_del = [r["id"] for r in rows]
                conn.execute(f"DELETE FROM influencer_memory WHERE id IN ({','.join(['?']*len(ids_to_del))})", ids_to_del)
                stats["consolidated"] = len(ids_to_del)
                conn.commit()
                
            except Exception as e:
                print(f"[MemoryAgent] Consolidation failed: {e}")
                
        return stats
