import { unzipSync } from 'fflate';
import { decompress } from 'fzstd';

// Simple lightweight TAR parser
function parseTar(tarBytes: Uint8Array): Record<string, string> {
  const files: Record<string, string> = {};
  let offset = 0;
  
  while (offset < tarBytes.length) {
    if (offset + 512 > tarBytes.length) break;
    
    // Check if header is empty (all zeroes)
    let isEmpty = true;
    for (let i = 0; i < 512; i++) {
      if (tarBytes[offset + i] !== 0) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) break;
    
    // File name (offset 0, length 100)
    const nameBytes = tarBytes.subarray(offset, offset + 100);
    let nameLen = nameBytes.indexOf(0);
    if (nameLen === -1) nameLen = 100;
    const name = new TextDecoder('utf-8').decode(nameBytes.subarray(0, nameLen));
    
    // File size (offset 124, length 12) - octal string
    const sizeStr = new TextDecoder('utf-8').decode(tarBytes.subarray(offset + 124, offset + 124 + 12)).trim();
    const size = parseInt(sizeStr, 8);
    
    // File type (offset 156, length 1)
    const typeFlag = tarBytes[offset + 156];
    
    offset += 512; // skip header
    
    // Normal file type is '0' (48) or '\0' (0)
    if ((typeFlag === 48 || typeFlag === 0 || typeFlag === 0x00) && size > 0) {
      if (name.endsWith('.json')) {
        const fileContentBytes = tarBytes.subarray(offset, offset + size);
        files[name] = new TextDecoder('utf-8').decode(fileContentBytes);
      }
      offset += Math.ceil(size / 512) * 512;
    } else {
      offset += Math.ceil(size / 512) * 512;
    }
  }
  return files;
}

// Extract JSON files from ZIP using unzipSync
function unzipJsonOnly(zipBytes: Uint8Array): Record<string, string> {
  const unzipped = unzipSync(zipBytes);
  const files: Record<string, string> = {};
  
  for (const [name, fileBytes] of Object.entries(unzipped)) {
    if (name.endsWith('.json')) {
      files[name] = new TextDecoder('utf-8').decode(fileBytes);
    }
  }
  
  return files;
}

// Normalize Beta backup
function normalizeBeta(files: Record<string, string>): any {
  const manifest = JSON.parse(files['manifest.json'] || files['/manifest.json'] || '{}');
  const rawHistories = JSON.parse(files['read_histories.json'] || files['/read_histories.json'] || '[]');
  
  const books: any[] = [];
  const bookmarks: any[] = [];
  const bookJsonPattern = /books\/([a-f0-9]+)\/book\.json$/i;
  const bookPaths = Object.keys(files).filter(k => bookJsonPattern.test(k));
  
  let totalChaptersCount = 0;
  let totalChaptersRead = 0;
  let totalChaptersDownloaded = 0;
  
  for (const bp of bookPaths) {
    const match = bp.match(bookJsonPattern);
    if (!match) continue;
    const bookId = match[1];
    
    try {
      const bookData = JSON.parse(files[bp]);
      const name = bookData.name?.raw || bookData.name?.qt || bookData.name || 'Truyện không tên';
      const author = bookData.author?.raw || bookData.author?.qt || bookData.author || 'Khuyết danh';
      const coverUrl = bookData.cover || '';
      const source = bookData.source || bookData.extension_id || 'Unknown';
      const totalReadTimeMs = bookData.total_read_time || 0;
      const totalListenTimeMs = bookData.total_listened_time || 0;
      const chapterCount = bookData.total_chapter || 0;
      const lastReadIndex = bookData.last_read_chapter_index || 0;
      const progressPercent = chapterCount > 0 ? lastReadIndex / chapterCount : 0;
      const lastReadTimestamp = bookData.last_read || 0;
      
      const cpPath = bp.replace('book.json', 'chapters.json');
      let chaptersRead = 0;
      let chaptersDownloaded = 0;
      if (files[cpPath]) {
        const chapters = JSON.parse(files[cpPath]);
        totalChaptersCount += chapters.length;
        for (const c of chapters) {
          if (c.last_read > 0) chaptersRead++;
          if (c.downloaded) chaptersDownloaded++;
        }
      }
      
      // Strict calculation: only count chapters that actually have a read timestamp
      totalChaptersRead += chaptersRead;
      totalChaptersDownloaded += chaptersDownloaded;
      
      books.push({
        id: bookId,
        name,
        author,
        coverUrl,
        source,
        totalReadTimeMs,
        totalListenTimeMs,
        chapterCount,
        chaptersReadCount: chaptersRead,
        chaptersDownloadedCount: chaptersDownloaded,
        lastReadIndex,
        progressPercent,
        lastReadTimestamp
      });
      
      const bmPath = bp.replace('book.json', 'bookmarks.json');
      if (files[bmPath]) {
        const bookBookmarks = JSON.parse(files[bmPath]);
        for (const bm of bookBookmarks) {
          const isHighlight = bm.type === 1;
          bookmarks.push({
            bookId,
            chapterName: bm.chapter_name || '',
            content: bm.content || '',
            isHighlight,
            color: bm.color,
            timestamp: bm.create_at || 0
          });
        }
      }
    } catch (e) {
      console.error('Error parsing book ' + bookId, e);
    }
  }
  
  const authorGroups: Record<string, { totalReadTimeMs: number; bookCount: number }> = {};
  for (const b of books) {
    if (!authorGroups[b.author]) {
      authorGroups[b.author] = { totalReadTimeMs: 0, bookCount: 0 };
    }
    authorGroups[b.author].totalReadTimeMs += b.totalReadTimeMs;
    authorGroups[b.author].bookCount += 1;
  }
  const topAuthors = Object.entries(authorGroups)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.totalReadTimeMs - a.totalReadTimeMs);
    
  const highlights = bookmarks.filter(b => b.isHighlight && b.content.length > 5);
  let randomQuote: any = null;
  if (highlights.length > 0) {
    const randomIdx = Math.floor(Math.random() * highlights.length);
    const chosen = highlights[randomIdx];
    const bInfo = books.find(x => x.id === chosen.bookId);
    randomQuote = {
      text: chosen.content,
      bookName: bInfo ? bInfo.name : 'Truyện',
      chapterName: chosen.chapterName
    };
  }
  
  const bookmarkCounts: Record<string, number> = {};
  for (const bm of bookmarks) {
    bookmarkCounts[bm.bookId] = (bookmarkCounts[bm.bookId] || 0) + 1;
  }
  let bookWithMostBookmarks: any = undefined;
  let maxBookmarks = 0;
  for (const [bid, count] of Object.entries(bookmarkCounts)) {
    if (count > maxBookmarks) {
      maxBookmarks = count;
      const bInfo = books.find(x => x.id === bid);
      if (bInfo) {
        bookWithMostBookmarks = { bookName: bInfo.name, count };
      }
    }
  }

  const sessionDurations = rawHistories.map((h: any) => h.read_time + h.listen_time).filter((d: number) => d > 0);
  const maxSessionDurationMs = sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0;
  const avgSessionDurationMs = sessionDurations.length > 0 ? sessionDurations.reduce((a: number, b: number) => a + b, 0) / sessionDurations.length : 0;
  
  const activeDays = new Set<string>();
  for (const h of rawHistories) {
    if (h.create_at) {
      const dayStr = new Date(h.create_at).toDateString();
      activeDays.add(dayStr);
    }
  }
  const activeDaysCount = activeDays.size;

  return {
    version: 'beta',
    meta: {
      deviceName: manifest.device_name || 'Thiết bị vBook',
      backupDate: manifest.create_at ? new Date(manifest.create_at).toLocaleDateString('vi-VN') : 'Không rõ'
    },
    books,
    totalBooksCount: books.length,
    totalChaptersCount,
    totalChaptersRead,
    totalChaptersDownloaded,
    totalBookmarksCount: bookmarks.length,
    bookWithMostBookmarks,
    randomQuote,
    readHistories: rawHistories.map((h: any) => ({
      timestamp: h.create_at || 0,
      readTimeMs: h.read_time || 0,
      listenTimeMs: h.listen_time || 0
    })),
    maxSessionDurationMs,
    avgSessionDurationMs,
    activeDaysCount,
    topAuthors
  };
}

// Normalize Stable backup
function normalizeStable(files: Record<string, string>): any {
  const rawBookmarks = JSON.parse(files['data/bookmarks.json'] || files['/data/bookmarks.json'] || '[]');
  const books: any[] = [];
  const bookmarks: any[] = [];
  const bookJsonPattern = /books\/([a-f0-9]+)\/book\.json$/i;
  const bookPaths = Object.keys(files).filter(k => bookJsonPattern.test(k));
  
  let totalChaptersCount = 0;
  let totalChaptersRead = 0;
  let totalChaptersDownloaded = 0;
  let maxLastReadTimestamp = 0;
  
  for (const bp of bookPaths) {
    const match = bp.match(bookJsonPattern);
    if (!match) continue;
    const bookId = match[1];
    
    try {
      const bookData = JSON.parse(files[bp]);
      const name = bookData.name || 'Truyện không tên';
      const author = bookData.author || 'Khuyết danh';
      const coverUrl = bookData.cover || '';
      const source = bookData.book_source || bookData.extension_id || 'Unknown';
      const totalReadTimeMs = bookData.total_reading_time || 0;
      const totalListenTimeMs = bookData.total_tts_time || 0;
      const chapterCount = bookData.chapter_count || 0;
      const lastReadIndex = bookData.last_index || 0;
      const progressPercent = bookData.percent || (chapterCount > 0 ? lastReadIndex / chapterCount : 0);
      const lastReadTimestamp = bookData.timestamp || 0;
      
      if (lastReadTimestamp > maxLastReadTimestamp) {
        maxLastReadTimestamp = lastReadTimestamp;
      }
      
      const cpPath = bp.replace('book.json', 'chapters.json');
      const chaptersRead = Math.min(lastReadIndex + 1, chapterCount);
      let chaptersDownloaded = 0;
      if (files[cpPath]) {
        const chapters = JSON.parse(files[cpPath]);
        totalChaptersCount += chapters.length;
        for (const c of chapters) {
          if (c.downloaded) chaptersDownloaded++;
        }
      }
      totalChaptersRead += chaptersRead;
      totalChaptersDownloaded += chaptersDownloaded;
      
      books.push({
        id: bookId,
        name,
        author,
        coverUrl,
        source,
        totalReadTimeMs,
        totalListenTimeMs,
        chapterCount,
        chaptersReadCount: chaptersRead,
        chaptersDownloadedCount: chaptersDownloaded,
        lastReadIndex,
        progressPercent,
        lastReadTimestamp
      });
    } catch (e) {
      console.error('Error parsing stable book ' + bookId, e);
    }
  }
  
  for (const bm of rawBookmarks) {
    const isHighlight = bm.h > 0 || (bm.content && !bm.content.endsWith('%'));
    bookmarks.push({
      bookId: bm.name,
      chapterName: bm.title || '',
      content: bm.content || '',
      isHighlight,
      timestamp: bm.timestamp || 0
    });
  }
  
  const authorGroups: Record<string, { totalReadTimeMs: number; bookCount: number }> = {};
  for (const b of books) {
    if (!authorGroups[b.author]) {
      authorGroups[b.author] = { totalReadTimeMs: 0, bookCount: 0 };
    }
    authorGroups[b.author].totalReadTimeMs += b.totalReadTimeMs;
    authorGroups[b.author].bookCount += 1;
  }
  const topAuthors = Object.entries(authorGroups)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.totalReadTimeMs - a.totalReadTimeMs);
    
  const highlights = bookmarks.filter(b => b.isHighlight && b.content.length > 5);
  let randomQuote: any = null;
  if (highlights.length > 0) {
    const randomIdx = Math.floor(Math.random() * highlights.length);
    const chosen = highlights[randomIdx];
    const bInfo = books.find(x => x.id === chosen.bookId);
    randomQuote = {
      text: chosen.content,
      bookName: bInfo ? bInfo.name : 'Truyện',
      chapterName: chosen.chapterName
    };
  }
  
  const bookmarkCounts: Record<string, number> = {};
  for (const bm of bookmarks) {
    bookmarkCounts[bm.bookId] = (bookmarkCounts[bm.bookId] || 0) + 1;
  }
  let bookWithMostBookmarks: any = undefined;
  let maxBookmarks = 0;
  for (const [bid, count] of Object.entries(bookmarkCounts)) {
    if (count > maxBookmarks) {
      maxBookmarks = count;
      const bInfo = books.find(x => x.id === bid);
      if (bInfo) {
        bookWithMostBookmarks = { bookName: bInfo.name, count };
      }
    }
  }

  return {
    version: 'stable',
    meta: {
      deviceName: 'Thiết bị vBook (Stable)',
      backupDate: maxLastReadTimestamp ? new Date(maxLastReadTimestamp).toLocaleDateString('vi-VN') : 'Không rõ'
    },
    books,
    totalBooksCount: books.length,
    totalChaptersCount,
    totalChaptersRead,
    totalChaptersDownloaded,
    totalBookmarksCount: bookmarks.length,
    bookWithMostBookmarks,
    randomQuote,
    readHistories: [],
    topAuthors
  };
}

// Main message handler
self.onmessage = async (e) => {
  const { fileBuffer } = e.data;
  
  try {
    postMessage({ type: 'progress', percent: 10, status: 'Nhận dạng tệp backup...' });
    const bytes = new Uint8Array(fileBuffer);
    
    let rawFiles: Record<string, string> = {};
    
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
    const isZstd = bytes[0] === 0x28 && bytes[1] === 0xB5 && bytes[2] === 0x2F && bytes[3] === 0xFD;
    
    if (isZip) {
      postMessage({ type: 'progress', percent: 40, status: 'Giải nén tệp ZIP...' });
      rawFiles = unzipJsonOnly(bytes);
    } else if (isZstd) {
      postMessage({ type: 'progress', percent: 25, status: 'Giải nén lớp phủ Zstandard...' });
      const tarBytes = decompress(bytes);
      postMessage({ type: 'progress', percent: 50, status: 'Giải nén cấu trúc TAR...' });
      rawFiles = parseTar(tarBytes);
    } else {
      // Test if it is raw tar
      postMessage({ type: 'progress', percent: 30, status: 'Đang đọc cấu trúc tệp TAR...' });
      try {
        rawFiles = parseTar(bytes);
        if (Object.keys(rawFiles).length === 0) {
          throw new Error();
        }
      } catch {
        throw new Error('Định dạng tệp không hỗ trợ! Vui lòng tải lên tệp .zip, .tar hoặc .tar.zst của vBook.');
      }
    }
    
    postMessage({ type: 'progress', percent: 75, status: 'Phát hiện phiên bản vBook và phân tích...' });
    
    const isBeta = 'manifest.json' in rawFiles || '/manifest.json' in rawFiles;
    const isStable = 'data/bookmarks.json' in rawFiles || '/data/bookmarks.json' in rawFiles || 'prefs/setting.json' in rawFiles;
    
    let normalizedData: any;
    if (isBeta) {
      normalizedData = normalizeBeta(rawFiles);
    } else if (isStable || Object.keys(rawFiles).some(k => k.includes('books/'))) {
      normalizedData = normalizeStable(rawFiles);
    } else {
      throw new Error('Tệp backup trống hoặc không đúng cấu trúc thư mục của vBook!');
    }
    
    postMessage({ type: 'progress', percent: 100, status: 'Hoàn thành phân tích!' });
    postMessage({ type: 'success', data: normalizedData });
    
  } catch (error: any) {
    postMessage({ type: 'error', error: error.message || 'Lỗi không xác định trong quá trình xử lý tệp!' });
  }
};
