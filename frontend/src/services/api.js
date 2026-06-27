// Konfigurasi endpoint backend FastAPI
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_URL = `${API_BASE}/api`;

export const chatWithBot = async (messages, model, signal = null, onChunk = null, onEvent = null) => {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages, model }), 
      signal, // Menerima sinyal pembatalan dari AbortController
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    // Membaca stream respons (Server-Sent Events)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let replyText = "";
    let buffer = "";
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // SSE memisahkan setiap event dengan double newline (\n\n)
      let boundaryIndex;
      while ((boundaryIndex = buffer.indexOf('\n\n')) >= 0) {
        const chunkStr = buffer.slice(0, boundaryIndex).trim();
        buffer = buffer.slice(boundaryIndex + 2);
        
        if (chunkStr.startsWith('data:')) {
          const dataStr = chunkStr.replace(/^data:\s*/, '').trim();
          if (!dataStr) continue;
          
          let data;
          try {
            data = JSON.parse(dataStr);
          } catch(e) {
             console.warn("JSON Parse error pada chunk:", dataStr, e);
             continue;
          }

          if (data.error) {
            // Terjadi error di backend (lempar keluar agar ditangkap oleh App.jsx)
            throw new Error(data.error);
          }
          if (data.status) {
            if (onEvent) onEvent(data);
          }
          if (data.text) {
            replyText += data.text;
            if (onChunk) onChunk(replyText);
          }
        }
      }
    }
    
    return replyText;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log("Chat aborted by user");
      throw error; 
    }
    console.error("Chat error:", error);
    throw error; // Biarkan komponen UI menangkapnya
  }
};
