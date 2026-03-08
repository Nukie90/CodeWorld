import os
import json
import httpx
import pathlib
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

# Load env vars at module level before initializing the service
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

class AIService:
    def __init__(self):
        # Fallback to reload if not set yet (just in case)
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "nvidia/nemotron-3-nano-30b-a3b:free"

    async def get_chat_response(
        self, 
        messages: List[Dict[str, Any]], 
        project_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "role": "assistant",
                "content": "Error: OPENROUTER_API_KEY is not configured in the backend environment. Please add it to your `.env` file."
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/Nukie90/CodeWorld", # Optional
            "X-Title": "CodeWorld AI Assistant", # Optional
        }

        # Inject system message with project context if it's the first message or explicitly provided
        full_messages = []
        
        if project_context:
            system_content = self._generate_system_prompt(project_context)
            full_messages.append({"role": "system", "content": system_content})
        
        # Add the rest of the conversation history
        # We need to ensure reasoning_details are preserved and passed back as per OpenRouter spec
        for msg in messages:
            cleaned_msg = {
                "role": msg["role"],
                "content": msg.get("content")
            }
            if msg.get("reasoning_details"):
                cleaned_msg["reasoning_details"] = msg["reasoning_details"]
            full_messages.append(cleaned_msg)

        payload = {
            "model": self.model,
            "messages": full_messages,
            "reasoning": {"enabled": False}
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    data=json.dumps(payload),
                    timeout=60.0 # AI can take a while to reason
                )
                response.raise_for_status()
                data = response.json()
                
                if "choices" in data and len(data["choices"]) > 0:
                    message = data["choices"][0]["message"]
                    content = message.get("content") or ""
                    cleaned_content = self._clean_content(content)
                    
                    return {
                        "role": "assistant",
                        "content": cleaned_content,
                        "reasoning_details": message.get("reasoning_details")
                    }
                else:
                    return {
                        "role": "assistant",
                        "content": f"Error: Unexpected response from OpenRouter: {json.dumps(data)}"
                    }
            except Exception as e:
                return {
                    "role": "assistant",
                    "content": f"Error communicating with AI service: {str(e)}"
                }

    def _generate_system_prompt(self, context: Dict[str, Any]) -> str:
        repo_url = context.get("repo_url", "Unknown")
        folder_metrics = context.get("folder_metrics", {})
        individual_files = context.get("individual_files", [])
        
        # Create a condensed list of files and their complexities
        file_summary = []
        for f in individual_files[:20]: # Limit to top 20 for prompt size
            file_summary.append(f"- {f['filename']} (Complexity: {f.get('total_cognitive_complexity', 0)})")
            
        system_prompt = f"""You are the CodeWorld AI Assistant. You help users understand their codebase through 3D visualization.
Current Project Information:
- Repository: {repo_url}


Answer user questions accurately based on this project context. If you don't know something, be honest.
Provide only the final answer in your response content. Do not include 'Reasoning Steps' or 'Final Answer' headers."""
        return system_prompt

    def _clean_content(self, content: str) -> str:
        """Helper to remove reasoning headers if the model includes them despite instructions."""
        if not content:
            return content
        
        # Look for common markers like **Final Answer**
        markers = ["**Final Answer**:", "**Final Answer**", "Final Answer:", "Final Answer"]
        for marker in markers:
            if marker in content:
                # Take everything after the marker
                parts = content.split(marker, 1)
                if len(parts) > 1:
                    return parts[1].strip()
        
        # Also handle "Reasoning Steps" followed by "Final Answer"
        if "**Reasoning Steps**" in content and "**Final Answer**" in content:
            return content.split("**Final Answer**", 1)[1].strip()
            
        return content

ai_service = AIService()
