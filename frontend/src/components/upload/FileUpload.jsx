import React, { useState, useRef } from 'react';
import { uploadMedia } from '../../services/api';

const FileUpload = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    
    try {
      // Panggil backend API
      const reply = await uploadMedia(file);
      if (onUploadSuccess) {
        onUploadSuccess(reply);
      }
    } catch (error) {
      console.error(error);
      if (onUploadSuccess) {
        onUploadSuccess(`Gagal memproses file: ${file.name}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-section">
      <h3 style={{ fontFamily: 'var(--font-heading)' }}>Unggah Berkas</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Deteksi kebenaran dari Gambar, Video, atau Dokumen.
      </p>
      
      <div 
        className={`upload-box ${isDragging ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerSelect}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          style={{ display: 'none' }} 
          onChange={handleChange}
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        />
        
        {isUploading ? (
          <div className="upload-text" style={{ color: 'var(--primary)' }}>
            <span className="upload-icon" style={{ display: 'block', animation: 'spin 1s linear infinite' }}>⚙️</span>
            Memproses...
          </div>
        ) : (
          <>
            <div className="upload-icon">📁</div>
            <div className="upload-text">Klik atau Tarik File ke sini</div>
            <div className="upload-subtext">Mendukung TXT, PDF, DOC, JPG, MP4</div>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
