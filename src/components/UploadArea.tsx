import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, RefreshCw } from 'lucide-react';

interface UploadAreaProps {
  onParseSuccess: (data: any) => void;
}

export default function UploadArea({ onParseSuccess }: UploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;

    // Check file size (max 500MB to prevent browser crash)
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`Tệp tin quá lớn (Lớn hơn 500MB). Vui lòng thử tệp nhỏ hơn!`);
      return;
    }
    
    // Reset state
    setError(null);
    setIsLoading(true);
    setProgress(5);
    setStatusText('Đang đọc tệp tin sao lưu...');

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) {
        setError('Không thể trích xuất nội dung tệp tin!');
        setIsLoading(false);
        return;
      }
      
      const fileBuffer = e.target.result as ArrayBuffer;
      
      try {
        const worker = new Worker(
          new URL('../workers/parser.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (event) => {
          const { type, percent, status, data, error: workerErr } = event.data;
          
          if (type === 'progress') {
            setProgress(percent);
            setStatusText(status);
          } else if (type === 'success') {
            setIsLoading(false);
            onParseSuccess(data);
            worker.terminate();
          } else if (type === 'error') {
            setError(workerErr);
            setIsLoading(false);
            worker.terminate();
          }
        };

        worker.postMessage({ fileBuffer }, [fileBuffer]);
      } catch (err: any) {
        setError('Không thể khởi tạo bộ xử lý tệp tin: ' + err.message);
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Lỗi khi đọc tệp tin từ đĩa!');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.click();
  };

  return (
    <div className="upload-screen">
      {/* Hidden file input is OUTSIDE the clickable wrapper card to prevent bubbling issues */}
      <input 
        ref={inputRef}
        type="file" 
        accept=".zip,.tar,.zst" 
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      <div className="upload-header animate-fade-in">
        <h1 className="upload-title">vBook Wrapped</h1>
        <p className="upload-subtitle">
          Khám phá hành trình đọc sách của bạn bằng cách tải lên tệp tin sao lưu vBook
        </p>
      </div>

      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={!isLoading ? onButtonClick : undefined}
        className={`upload-card ${dragActive ? 'drag-active' : ''} ${isLoading ? 'loading' : ''} animate-fade-in`}
      >
        {isLoading ? (
          <div className="loading-wrapper">
            <div className="loading-circle-wrapper">
              <RefreshCw className="loading-circle" size={48} />
              <div className="loading-percent">{progress}%</div>
            </div>
            <p className="loading-status">{statusText}</p>
            <div className="loading-bar-bg">
              <div 
                className="loading-bar-fill" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="loading-note">Phân tích bảo mật 100% offline tại trình duyệt</p>
          </div>
        ) : (
          <>
            <div className="upload-icon-wrapper">
              <Upload size={32} />
            </div>
            <p className="upload-text-main">
              Kéo thả tệp sao lưu (backup) vào đây
            </p>
            <p className="upload-text-sub">
              hoặc nhấp chuột để chọn tệp tin<br/>
              Hỗ trợ định dạng .zip, .tar, .tar.zst (Tối đa 500MB)
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="error-card animate-fade-in">
          <AlertCircle className="error-icon" size={20} />
          <div>
            <h4 className="error-title">Lỗi xử lý tệp</h4>
            <p className="error-desc">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
