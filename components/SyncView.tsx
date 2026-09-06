'use client';

import { useState, useRef, useEffect } from 'react';
import { FeedItem } from '@/hooks/usePeerSync';

interface SyncViewProps {
  feed: FeedItem[];
  onSendText: (t: string) => void;
  onSendFile: (file: File) => Promise<void>;
  code: string;
  isHost: boolean;
  onDisconnect: () => void;
  autoSync: boolean;
  setAutoSync: (val: boolean) => void;
}

export function SyncView({ feed, onSendText, onSendFile, code, isHost, onDisconnect, autoSync, setAutoSync }: SyncViewProps) {
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    onSendText(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onSendFile(e.target.files[0]);
      e.target.value = ''; // Reset
    }
  };

  return (
    <div className="fade-in w-full flex flex-col h-[70vh] md:h-[600px] max-h-[800px]">
      
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--connected-bg)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--connected)', animation: 'pulse-dot 2.5s ease-in-out infinite' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--connected)' }}>Room {code}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: autoSync ? 'var(--accent)' : 'var(--text-muted)' }}>
            <input 
              type="checkbox" 
              checked={autoSync} 
              onChange={e => setAutoSync(e.target.checked)} 
              className="accent-[var(--accent)]"
            />
            <span className="font-medium">Auto-Sync Clipboard</span>
          </label>
          <button
            onClick={onDisconnect}
            className="text-xs font-medium cursor-pointer px-2 py-1 rounded-lg"
            style={{ color: 'var(--text-muted)', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* ── Feed Area ── */}
      <div className="flex-1 overflow-y-auto pr-2 pb-4 flex flex-col-reverse" style={{ scrollbarWidth: 'thin' }}>
        <div ref={feedEndRef} />
        
        {feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/>
            </svg>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              Room connected.<br/>Type, paste, or select a file to send.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feed.slice().reverse().map(item => {
              const isMe = item.sender === 'me';
              return (
                <div key={item.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className="max-w-[85%] rounded-2xl p-4 shadow-sm"
                    style={{ 
                      background: isMe ? 'var(--accent)' : 'var(--surface-2)',
                      color: isMe ? '#ffffff' : 'var(--text)',
                      border: isMe ? 'none' : '1px solid var(--border)',
                      borderBottomRightRadius: isMe ? '4px' : '1rem',
                      borderBottomLeftRadius: !isMe ? '4px' : '1rem',
                    }}
                  >
                    {/* TEXT */}
                    {item.type === 'text' && (
                      <div className="whitespace-pre-wrap text-sm" style={{ wordBreak: 'break-word' }}>
                        {item.content}
                      </div>
                    )}

                    {/* IMAGE */}
                    {item.type === 'image' && (
                      <div className="flex flex-col gap-2">
                        <img src={item.fileUrl} alt="Received Image" className="max-w-full rounded-lg max-h-64 object-contain" />
                        <div className="flex justify-between items-center text-xs opacity-80">
                          <span className="truncate max-w-[150px]">{item.fileName}</span>
                          <span>{formatFileSize(item.fileSize)}</span>
                        </div>
                      </div>
                    )}

                    {/* FILE */}
                    {item.type === 'file' && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/20">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="text-sm font-semibold truncate">{item.fileName}</span>
                          <span className="text-xs opacity-80">{formatFileSize(item.fileSize)}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions (Copy/Download) for received items */}
                    {!isMe && (
                      <div className="flex justify-end mt-2 pt-2 gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        {item.type === 'text' ? (
                          <button 
                            onClick={() => navigator.clipboard.writeText(item.content || '')}
                            className="text-xs font-semibold px-2 py-1 bg-white/50 dark:bg-black/10 rounded cursor-pointer hover:bg-white/80"
                          >
                            Copy
                          </button>
                        ) : (
                          <a 
                            href={item.fileUrl} 
                            download={item.fileName}
                            className="text-xs font-semibold px-2 py-1 bg-white/50 dark:bg-black/10 rounded cursor-pointer hover:bg-white/80"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Input Area ── */}
      <div className="mt-2 pt-3 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl cursor-pointer"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or paste (Ctrl+V) text/images here..."
          rows={1}
          className="flex-1 resize-none rounded-xl text-sm p-3"
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
          }}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; }}
        />
        
        <button 
          onClick={handleSendText}
          disabled={!inputText.trim()}
          className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl cursor-pointer"
          style={{ 
            background: inputText.trim() ? 'var(--accent)' : 'var(--surface-2)', 
            border: 'none',
            color: inputText.trim() ? '#fff' : 'var(--text-faint)' 
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

    </div>
  );
}
