import React, { useState, useRef, useEffect } from 'react';
import Message from './Message';
import { chatWithBot } from '../../services/api';

const ChatBox = ({ externalMessage, onMessageProcessed }) => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Halo! Saya si-FAKTA. Ada berita atau informasi yang ingin Anda cek kebenarannya hari ini?", isUser: false }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle external message (like after file upload)
  useEffect(() => {
    if (externalMessage) {
      addBotMessage(externalMessage);
      if (onMessageProcessed) {
        onMessageProcessed();
      }
    }
  }, [externalMessage]);

  const addBotMessage = (text) => {
    setMessages(prev => [...prev, { id: Date.now(), text, isUser: false }]);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setMessages(prev => [...prev, { id: Date.now(), text: userText, isUser: true }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const reply = await chatWithBot(userText);
      addBotMessage(reply);
    } catch (err) {
      addBotMessage("Gagal terhubung ke server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-section">
      <div className="messages-container">
        {messages.map(msg => (
          <Message key={msg.id} text={msg.text} isUser={msg.isUser} />
        ))}
        {isLoading && (
          <div className="message bot" style={{ opacity: 0.7 }}>
            Mengetik...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="input-area" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Ketik tautan berita atau tanyakan sesuatu..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Kirim
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
