import { Download, BookOpen } from 'lucide-react';
import { toPng } from 'html-to-image';

interface DashboardProps {
  data: any;
  onReset: () => void;
}

export default function Dashboard({ data, onReset }: DashboardProps) {
  const {
    version,
    meta,
    books,
    totalBooksCount,
    totalChaptersRead,
    totalBookmarksCount,
    activeDaysCount
  } = data;

  // 1. Time Calculations
  const totalReadTimeMs = books.reduce((acc: number, b: any) => acc + b.totalReadTimeMs, 0);
  const totalListenTimeMs = books.reduce((acc: number, b: any) => acc + b.totalListenTimeMs, 0);
  const totalTimeMs = totalReadTimeMs + totalListenTimeMs;
  
  const totalHours = totalTimeMs / 1000 / 3600;
  
  // Format huge numbers to standard format e.g. "1.191"
  const formattedHours = totalHours.toLocaleString('vi-VN', { maximumFractionDigits: 0 });

  // 2. Top books sorting
  const sortedBooks = [...books].sort((a, b) => b.totalReadTimeMs + b.totalListenTimeMs - (a.totalReadTimeMs + a.totalListenTimeMs));
  const top1Book = sortedBooks[0];
  const top2to5Books = sortedBooks.slice(1, 5);

  // 3. DNA / Profile
  let dnaArchetype = 'Độc Giả Đa Năng';
  if (books.some((b: any) => b.source.includes('MTC') || b.source.includes('metruyencv'))) {
    dnaArchetype = 'TU SĨ MÊ TRUYỆN';
  } else if (totalBookmarksCount > 20) {
    dnaArchetype = 'NHÀ NGHIÊN CỨU';
  } else if (totalListenTimeMs > totalReadTimeMs) {
    dnaArchetype = 'THÍNH GIẢ ĐÊM';
  }

  // 4. Achievements / Tags
  const achievements = [];
  if (totalHours >= 100) achievements.push('Chiến Thần Đọc');
  if (totalBookmarksCount >= 10) achievements.push('Kẻ Ghi Nhớ');
  if (totalBooksCount >= 50) achievements.push('Mọt Sách Thực Thụ');
  if (achievements.length === 0) achievements.push('Người Khởi Đầu');

  // Export dashboard to image
  const handleExport = () => {
    const node = document.getElementById('dashboard-content');
    if (!node) return;
    
    // Hide buttons during export
    const actions = document.getElementById('header-actions');
    if (actions) actions.style.display = 'none';

    toPng(node, { 
      backgroundColor: '#fbfbfb',
      style: { transform: 'scale(1)', width: node.offsetWidth + 'px', height: node.offsetHeight + 'px' },
      cacheBust: true,
      pixelRatio: 2
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `vBook-Wrapped-${meta.deviceName || '2026'}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Lỗi khi xuất ảnh:', err);
        // Fallback: try without cacheBust/pixelRatio or warn user about CORS
        alert('Lỗi khi tạo ảnh (có thể do CORS từ ảnh bìa sách). Vui lòng thử lại!');
      })
      .finally(() => {
        if (actions) actions.style.display = 'flex';
      });
  };

  return (
    <div className="dashboard-container" id="dashboard-content">
      {/* Editorial Header */}
      <div className="dashboard-header">
        <div className="header-brand">
          vBook <span>Wrapped</span>
        </div>
        <div className="header-actions" id="header-actions">
          <button onClick={onReset} className="btn-editorial" style={{ border: 'none' }}>
            Phân Tích Tệp Khác
          </button>
          <button onClick={handleExport} className="btn-editorial" style={{ background: '#1a1a1a', color: '#fff' }}>
            <Download size={14} /> Lưu Poster
          </button>
        </div>
      </div>

      {/* Hero Typography */}
      <div className="poster-hero animate-fade-in">
        <div className="hero-number-wrapper">
          <span className="hero-number">{formattedHours}</span>
          <span className="hero-unit">GIỜ<br/>ĐẮM CHÌM</span>
        </div>
        <div className="hero-subtitle">
          Tương đương với hàng ngàn chương truyện, bạn đã sống nhiều cuộc đời khác nhau trong năm qua. Bạn là một phần của 7% những người đọc nhiều nhất.
        </div>
      </div>

      {/* Asymmetric Body */}
      <div className="poster-body animate-fade-in" style={{ animationDelay: '0.2s' }}>
        
        {/* Left: Featured Book 3D */}
        <div className="poster-featured">
          <div className="featured-label">Cuốn sách của năm</div>
          
          {top1Book && (
            <div className="featured-book-showcase">
              {top1Book.coverUrl ? (
                <img 
                  src={`https://images.weserv.nl/?url=${encodeURIComponent(top1Book.coverUrl)}`} 
                  alt={top1Book.name} 
                  className="book-cover-3d" 
                  crossOrigin="anonymous" 
                />
              ) : (
                <div className="book-cover-3d" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
                  <BookOpen size={48} color="#94a3b8" />
                </div>
              )}
              
              <div className="featured-book-info">
                <div className="featured-book-stat">
                  {((top1Book.totalReadTimeMs + top1Book.totalListenTimeMs) / 1000 / 3600).toFixed(1)} Giờ
                </div>
                <h3 className="featured-book-title">{top1Book.name}</h3>
                <div className="featured-book-author">{top1Book.author}</div>
              </div>
            </div>
          )}

          <div className="quote-editorial">
            Mỗi cuốn sách là một thế giới thu nhỏ. Dấu ấn bạn để lại qua {totalBookmarksCount} ghi chú là minh chứng cho một tâm hồn yêu văn chương.
          </div>
        </div>

        {/* Right: Editorial Stats & DNA Stamp */}
        <div className="poster-stats custom-scroll">
          
          <div className="dna-stamp">
            <div className="dna-title">{dnaArchetype}</div>
            <div className="dna-stars">★★★★☆</div>
          </div>

          <div className="editorial-list">
            <div className="editorial-item">
              <span className="editorial-item-label">TỔNG SỐ SÁCH</span>
              <span className="editorial-item-value">{totalBooksCount}</span>
            </div>
            <div className="editorial-item">
              <span className="editorial-item-label">CHƯƠNG ĐÃ ĐỌC</span>
              <span className="editorial-item-value">{totalChaptersRead}</span>
            </div>
            <div className="editorial-item">
              <span className="editorial-item-label">CHUỖI NGÀY HOẠT ĐỘNG</span>
              <span className="editorial-item-value">{activeDaysCount > 0 ? activeDaysCount : 'N/A'}</span>
            </div>
          </div>

          <div>
            <div className="featured-label" style={{ marginBottom: '1rem' }}>Sách Nổi Bật Khác</div>
            <div className="editorial-books">
              {top2to5Books.map((book: any, idx: number) => (
                <div key={book.id} className="editorial-book-item">
                  <span className="editorial-book-idx">0{idx + 2}</span>
                  <div>
                    <div className="editorial-book-title">{book.name}</div>
                    <span className="editorial-book-author">{book.author}</span>
                  </div>
                  <span className="editorial-book-hours">
                    {((book.totalReadTimeMs + book.totalListenTimeMs) / 1000 / 3600).toFixed(0)}h
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="featured-label" style={{ marginBottom: '0.75rem' }}>Thành Tựu Đạt Được</div>
            <div className="editorial-tags">
              {achievements.map(ach => (
                <span key={ach} className="editorial-tag">{ach}</span>
              ))}
            </div>
          </div>

        </div>

      </div>

      <div className="poster-footer">
        {meta.deviceName} • BẢN SAO LƯU NGÀY {meta.backupDate} • VBOOK {version.toUpperCase()}
      </div>

    </div>
  );
}
