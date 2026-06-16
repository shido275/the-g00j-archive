import React, { useState, useEffect, useRef } from 'react';
import { 
  HardDrive, 
  Search, 
  Grid, 
  List, 
  Upload, 
  Folder, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  FileText, 
  Music, 
  Archive, 
  File as FileIcon, 
  Play, 
  Pause, 
  Trash2, 
  X, 
  Eye, 
  Download, 
  RefreshCw, 
  AlertCircle,
  FolderOpen,
  Info
} from 'lucide-react';
import { ChunkUploader } from './utils/chunkUploader';

function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [uploads, setUploads] = useState([]); // active uploads queue
  const [showQueue, setShowQueue] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  // Folders navigation state
  const [currentFolderId, setCurrentFolderId] = useState(null);
  
  // URL Scraper state
  const [showScraper, setShowScraper] = useState(false);
  const [scraperUrl, setScraperUrl] = useState('');
  const [scrapedResults, setScrapedResults] = useState([]);
  const [scraping, setScraping] = useState(false);
  const [downloadingUrls, setDownloadingUrls] = useState({});
  const [folders, setFolders] = useState([]);
  const [allFolders, setAllFolders] = useState([]);

  // Advanced scraper schedule states
  const [scraperJobs, setScraperJobs] = useState([]);
  const [scrapedFolderSelections, setScrapedFolderSelections] = useState({});
  const [scheduleOption, setScheduleOption] = useState('once');
  const [scheduleFolderId, setScheduleFolderId] = useState('root');

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);


  // Fetch files on search or category change
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/files', window.location.origin);
      if (activeCategory !== 'all') {
        url.searchParams.append('category', activeCategory);
      } else {
        if (!searchQuery) {
          url.searchParams.append('folderId', currentFolderId || 'root');
        }
      }
      if (searchQuery) {
        url.searchParams.append('search', searchQuery);
      }
      
      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const url = new URL('/api/folders', window.location.origin);
      if (currentFolderId) {
        url.searchParams.append('parentId', currentFolderId);
      } else {
        url.searchParams.append('parentId', 'root');
      }
      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }

      // Fetch all folders to compute breadcrumbs trail
      const allUrl = new URL('/api/folders', window.location.origin);
      allUrl.searchParams.append('all', 'true');
      const allResponse = await fetch(allUrl.toString());
      if (allResponse.ok) {
        const allData = await allResponse.json();
        setAllFolders(allData);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  useEffect(() => {
    fetchFiles();
    if (activeCategory === 'all' && !searchQuery) {
      fetchFolders();
    } else {
      setFolders([]);
    }
  }, [activeCategory, searchQuery, currentFolderId]);

  // Load preview file text if it is a text-based format
  useEffect(() => {
    if (!previewFile) {
      setTextContent('');
      return;
    }

    const textMimes = [
      'text/plain', 'text/html', 'text/css', 'text/csv', 
      'application/javascript', 'application/json', 'application/x-javascript'
    ];
    
    const isText = previewFile.mimeType.startsWith('text/') || textMimes.includes(previewFile.mimeType);

    if (isText) {
      setTextContent('Loading content...');
      fetch(`/api/files/download/${previewFile.id}`)
        .then(res => {
          if (!res.ok) throw new Error('Could not download file content');
          return res.text();
        })
        .then(text => {
          // Truncate to first 10,000 characters for safety
          if (text.length > 10000) {
            setTextContent(text.slice(0, 10000) + '\n\n...[Truncated: File is too large to preview fully]...');
          } else {
            setTextContent(text);
          }
        })
        .catch(err => {
          setTextContent(`Failed to load text preview: ${err.message}`);
        });
    }
  }, [previewFile]);

  // Total storage calculation based on metadata size
  const totalUsedStorage = files.reduce((acc, f) => acc + (f.size || 0), 0);

  // File categories count
  const getCategoryCount = (cat) => {
    if (cat === 'all') return files.length;
    return files.filter(f => f.category === cat).length;
  };

  // Helper size formats
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatETA = (seconds) => {
    if (seconds === Infinity || isNaN(seconds) || seconds <= 0) return '--';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Icon mapping
  const getCategoryIcon = (category, size = 18) => {
    switch (category) {
      case 'images': return <ImageIcon size={size} />;
      case 'videos': return <VideoIcon size={size} />;
      case 'documents': return <FileText size={size} />;
      case 'audio': return <Music size={size} />;
      case 'archives': return <Archive size={size} />;
      default: return <FileIcon size={size} />;
    }
  };

  // Handle standard manual pick files
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFilesSelect = (selectedFiles) => {
    if (!selectedFiles.length) return;
    setShowQueue(true);

    Array.from(selectedFiles).forEach(file => {
      const uploadKey = `${file.name}_${file.size}`;
      
      // Prevent duplicates in queue
      if (uploads.some(u => u.id === uploadKey && (u.status === 'uploading' || u.status === 'merging'))) {
        return;
      }

      const uploader = new ChunkUploader(file, {
        folderId: currentFolderId,
        onProgress: (pInfo) => {
          setUploads(prev => prev.map(u => 
            u.id === uploadKey 
              ? { ...u, progress: pInfo.progress, speed: pInfo.speed, eta: pInfo.eta } 
              : u
          ));
        },
        onStatusChange: (status) => {
          setUploads(prev => prev.map(u => 
            u.id === uploadKey ? { ...u, status } : u
          ));
          if (status === 'completed') {
            fetchFiles();
          }
        },
        onError: (err) => {
          console.error(err);
        }
      });

      const newUpload = {
        id: uploadKey,
        file,
        uploader,
        progress: 0,
        speed: 0,
        eta: 0,
        status: 'idle'
      };

      setUploads(prev => [newUpload, ...prev]);
      uploader.start();
    });

    // Reset file input value so same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    const folderName = window.prompt('Enter folder name:');
    if (!folderName || !folderName.trim()) return;

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName.trim(),
          parentId: currentFolderId || 'root'
        })
      });

      if (response.ok) {
        fetchFolders();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleDeleteFolder = async (e, id, name) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete folder "${name}"? This will recursively delete all subfolders and physically delete all files inside it.`)) {
      try {
        const response = await fetch(`/api/folders/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          fetchFolders();
          fetchFiles();
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
      }
    }
  };

  const getBreadcrumbs = () => {
    const crumbs = [];
    let currentId = currentFolderId;
    while (currentId) {
      const folder = allFolders.find(f => f.id === currentId);
      if (folder) {
        crumbs.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  };

  const handleScrape = async () => {
    if (!scraperUrl || !scraperUrl.trim()) return;
    setScraping(true);
    setScrapedResults([]);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scraperUrl.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setScrapedResults(data.downloads || []);
        if (data.downloads.length === 0) {
          alert('No safe downloadable file links found on this website.');
        }
      } else {
        alert(data.error || 'Failed to scrape link.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to connect to the scraper service.');
    } finally {
      setScraping(false);
    }
  };

  const handleRemoteDownload = async (link) => {
    const targetFolderId = scrapedFolderSelections[link.url] || currentFolderId;
    setDownloadingUrls(prev => ({ ...prev, [link.url]: 'downloading' }));
    try {
      const response = await fetch('/api/scrape/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: link.url,
          folderId: targetFolderId === 'root' ? null : targetFolderId
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setDownloadingUrls(prev => ({ ...prev, [link.url]: 'completed' }));
        fetchFiles();
      } else {
        setDownloadingUrls(prev => ({ ...prev, [link.url]: 'error' }));
        alert(data.error || 'Failed to download file.');
      }
    } catch (error) {
      console.error(error);
      setDownloadingUrls(prev => ({ ...prev, [link.url]: 'error' }));
      alert('Download connection failed.');
    }
  };

  const fetchScraperJobs = async () => {
    try {
      const response = await fetch('/api/scraper/jobs');
      if (response.ok) {
        const data = await response.json();
        setScraperJobs(data);
      }
    } catch (err) {
      console.error('Failed to fetch scraper jobs:', err);
    }
  };

  const handleCreateScheduleJob = async () => {
    if (!scraperUrl || !scraperUrl.trim()) {
      alert('Please enter a URL to schedule.');
      return;
    }

    try {
      const response = await fetch('/api/scraper/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: scraperUrl.trim(),
          folderId: scheduleFolderId === 'root' ? null : scheduleFolderId,
          schedule: scheduleOption
        })
      });

      if (response.ok) {
        fetchScraperJobs();
        alert('Scraper job scheduled successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to schedule job.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to schedule job.');
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this scheduled scraping job?')) {
      try {
        const response = await fetch(`/api/scraper/jobs/${jobId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          fetchScraperJobs();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Queue controls
  const handlePause = (upload) => {
    upload.uploader.pause();
  };

  const handleResume = (upload) => {
    upload.uploader.resume();
  };

  const handleCancel = (upload) => {
    upload.uploader.cancel();
    setUploads(prev => prev.filter(u => u.id !== upload.id));
  };

  const handleRemoveFinished = () => {
    setUploads(prev => prev.filter(u => u.status !== 'completed' && u.status !== 'error'));
  };

  // Action handlers on files
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this file from the G00J Archives?')) {
      try {
        const response = await fetch(`/api/files/${id}`, { method: 'DELETE' });
        if (response.ok) {
          fetchFiles();
          if (previewFile?.id === id) {
            setPreviewFile(null);
          }
        }
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  const handleDownload = (e, file) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = `/api/files/download/${file.id}?download=true`;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag and Drop events
  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  return (
    <div 
      className="app-container"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Background decorations */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Sidebar Panel */}
      <aside className="sidebar glass-panel">
        <div className="logo-section">
          <div className="logo-icon">
            <HardDrive size={22} color="#fff" />
          </div>
          <h1 className="logo-text">G00J ARCHIVES</h1>
        </div>

        <nav className="nav-menu">
          <a 
            className={`nav-item ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            <Folder size={18} />
            <span>All Files</span>
            <span className="nav-badge">{getCategoryCount('all')}</span>
          </a>
          <a 
            className={`nav-item ${activeCategory === 'images' ? 'active' : ''}`}
            onClick={() => setActiveCategory('images')}
          >
            <ImageIcon size={18} />
            <span>Images</span>
            <span className="nav-badge">{getCategoryCount('images')}</span>
          </a>
          <a 
            className={`nav-item ${activeCategory === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveCategory('videos')}
          >
            <VideoIcon size={18} />
            <span>Videos</span>
            <span className="nav-badge">{getCategoryCount('videos')}</span>
          </a>
          <a 
            className={`nav-item ${activeCategory === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveCategory('documents')}
          >
            <FileText size={18} />
            <span>Documents</span>
            <span className="nav-badge">{getCategoryCount('documents')}</span>
          </a>
          <a 
            className={`nav-item ${activeCategory === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveCategory('audio')}
          >
            <Music size={18} />
            <span>Audio</span>
            <span className="nav-badge">{getCategoryCount('audio')}</span>
          </a>
          <a 
            className={`nav-item ${activeCategory === 'archives' ? 'active' : ''}`}
            onClick={() => setActiveCategory('archives')}
          >
            <Archive size={18} />
            <span>Archives</span>
            <span className="nav-badge">{getCategoryCount('archives')}</span>
          </a>
          <a 
            className={`nav-item ${activeCategory === 'others' ? 'active' : ''}`}
            onClick={() => setActiveCategory('others')}
          >
            <FileIcon size={18} />
            <span>Others</span>
            <span className="nav-badge">{getCategoryCount('others')}</span>
          </a>
        </nav>

        {/* Unlimited Storage gauge */}
        <div className="storage-gauge-container">
          <div className="storage-header">
            <span className="storage-title">Storage Used</span>
            <span className="storage-val">{formatBytes(totalUsedStorage, 1)} / ∞</span>
          </div>
          <div className="storage-bar-bg" style={{ height: '3px' }}>
            <div 
              className="storage-bar-fill"
              style={{ width: '100%', background: 'var(--gradient-accent)' }}
            ></div>
          </div>
          <span className="storage-desc">Unlimited Storage Enabled</span>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        <header className="top-header glass-panel">
          <div className="search-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search files in the Archives..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="header-actions">
            <button 
              className="view-toggle-btn"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              title={viewMode === 'grid' ? "Switch to List View" : "Switch to Grid View"}
            >
              {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
            </button>

            {uploads.length > 0 && (
              <button 
                className="view-toggle-btn"
                onClick={() => setShowQueue(!showQueue)}
                title="Toggle Upload Queue"
                style={{ color: uploads.some(u => u.status === 'uploading' || u.status === 'merging') ? '#6366f1' : 'inherit' }}
              >
                <RefreshCw size={18} className={uploads.some(u => u.status === 'uploading') ? "spin" : ""} style={{ animation: uploads.some(u => u.status === 'uploading') ? 'spin 3s linear infinite' : 'none' }} />
              </button>
            )}

            <button 
              className="glow-btn action-btn" 
              onClick={handleCreateFolder}
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
            >
              <Folder size={16} />
              New Folder
            </button>

            <button 
              className="glow-btn action-btn" 
              onClick={() => { 
                setShowScraper(true); 
                setScraperUrl(''); 
                setScrapedResults([]); 
                setDownloadingUrls({}); 
                setScheduleFolderId(currentFolderId || 'root');
                fetchScraperJobs();
              }}
              style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', boxShadow: 'none' }}
            >
              <Search size={16} />
              Scrape Link
            </button>

            <button 
              className="glow-btn action-btn" 
              onClick={handleUploadClick}
            >
              <Upload size={16} />
              Upload Files
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              onChange={(e) => handleFilesSelect(e.target.files)} 
            />
          </div>
        </header>

        {/* Content body */}
        <section className="content-body">
          <div className="category-banner">
            <div>
              <h2 className="category-title">{activeCategory} Files</h2>
              <p className="category-subtitle">
                {(files.length + folders.length)} {(files.length + folders.length) === 1 ? 'item' : 'items'} stored in this category
              </p>
            </div>
          </div>

          {/* Breadcrumbs Navigation */}
          {activeCategory === 'all' && !searchQuery && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span 
                onClick={() => setCurrentFolderId(null)}
                style={{ cursor: 'pointer', color: currentFolderId ? 'var(--accent-indigo)' : 'inherit', fontWeight: currentFolderId ? 500 : 600 }}
              >
                Root
              </span>
              {getBreadcrumbs().map((crumb, idx) => (
                <React.Fragment key={crumb.id}>
                  <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                  <span 
                    onClick={() => setCurrentFolderId(crumb.id)}
                    style={{ 
                      cursor: 'pointer', 
                      color: idx === getBreadcrumbs().length - 1 ? 'inherit' : 'var(--accent-indigo)',
                      fontWeight: idx === getBreadcrumbs().length - 1 ? 600 : 500
                    }}
                  >
                    {crumb.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Drag drop zone helper */}
          <div 
            className={`drag-drop-zone ${isDragging ? 'dragging' : ''}`}
            onClick={handleUploadClick}
          >
            <div className="drag-icon-box">
              <Upload size={24} />
            </div>
            <div>
              <p className="drag-text-main">Drag and drop files here to upload</p>
              <p className="drag-text-sub">Supports large files, archives, video, images, or documents</p>
            </div>
          </div>

          {loading && files.length === 0 && folders.length === 0 ? (
            <div className="empty-state">
              <RefreshCw className="empty-icon spin" style={{ animation: 'spin 1.5s linear infinite' }} size={40} />
              <p>Fetching files from the Archives...</p>
            </div>
          ) : files.length === 0 && folders.length === 0 ? (
            <div className="empty-state">
              <FolderOpen className="empty-icon" size={48} />
              <p className="drag-text-main">No files or folders found in the G00J Archives</p>
              <p className="drag-text-sub">Select files or drag them above to start uploading to your storage!</p>
            </div>
          ) : viewMode === 'grid' ? (
            // Grid Layout
            <div className="files-grid">
              {/* Folder list */}
              {activeCategory === 'all' && !searchQuery && folders.map(folder => (
                <div 
                  key={folder.id} 
                  className="file-card glass-card"
                  onClick={() => setCurrentFolderId(folder.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="file-card-preview" style={{ height: '120px', background: 'rgba(99, 102, 241, 0.05)' }}>
                    <div className="file-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-indigo)', width: '48px', height: '48px' }}>
                      <Folder size={22} />
                    </div>
                  </div>
                  <div className="file-card-info" style={{ gap: '2px' }}>
                    <span className="file-name" title={folder.name}>{folder.name}</span>
                    <div className="file-meta">
                      <span>Folder</span>
                      <span>{new Date(folder.createdDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="file-card-actions" style={{ marginTop: '12px', paddingTop: '12px' }}>
                    <button 
                      className="file-action-btn btn-delete"
                      onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                      title="Delete Folder"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Files list */}
              {files.map(file => (
                <div 
                  key={file.id} 
                  className="file-card glass-card"
                  onClick={() => setPreviewFile(file)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="file-card-preview">
                    {file.category === 'images' ? (
                      <img 
                        src={`/api/files/download/${file.id}`} 
                        alt={file.originalName} 
                        className="file-card-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`file-icon-wrapper cat-${file.category}`}>
                        {getCategoryIcon(file.category, 28)}
                      </div>
                    )}
                  </div>
                  <div className="file-card-info">
                    <span className="file-name" title={file.originalName}>{file.originalName}</span>
                    <div className="file-meta">
                      <span>{formatBytes(file.size)}</span>
                      <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="file-card-actions">
                    <button 
                      className="file-action-btn"
                      onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                      title="Preview File"
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      className="file-action-btn"
                      onClick={(e) => handleDownload(e, file)}
                      title="Download File"
                    >
                      <Download size={14} />
                    </button>
                    <button 
                      className="file-action-btn btn-delete"
                      onClick={(e) => handleDelete(e, file.id)}
                      title="Delete File"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // List Layout
            <div className="files-list-wrapper glass-panel">
              <table className="files-list-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Uploaded Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Folders row list */}
                  {activeCategory === 'all' && !searchQuery && folders.map(folder => (
                    <tr 
                      key={folder.id} 
                      className="files-list-row"
                      onClick={() => setCurrentFolderId(folder.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="list-file-name-cell">
                          <div className="list-icon-box" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-indigo)' }}>
                            <Folder size={18} />
                          </div>
                          <span className="list-file-name-text" title={folder.name}>
                            {folder.name}
                          </span>
                        </div>
                      </td>
                      <td className="list-size-cell">--</td>
                      <td className="list-date-cell">{new Date(folder.createdDate).toLocaleDateString()}</td>
                      <td>
                        <div className="list-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="file-action-btn btn-delete"
                            onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                            title="Delete Folder"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Files row list */}
                  {files.map(file => (
                    <tr 
                      key={file.id} 
                      className="files-list-row"
                      onClick={() => setPreviewFile(file)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="list-file-name-cell">
                          <div className={`list-icon-box cat-${file.category}`}>
                            {getCategoryIcon(file.category, 18)}
                          </div>
                          <span className="list-file-name-text" title={file.originalName}>
                            {file.originalName}
                          </span>
                        </div>
                      </td>
                      <td className="list-size-cell">{formatBytes(file.size)}</td>
                      <td className="list-date-cell">{new Date(file.uploadDate).toLocaleDateString()}</td>
                      <td>
                        <div className="list-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="file-action-btn"
                            onClick={() => setPreviewFile(file)}
                            title="Preview File"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            className="file-action-btn"
                            onClick={(e) => handleDownload(e, file)}
                            title="Download File"
                          >
                            <Download size={14} />
                          </button>
                          <button 
                            className="file-action-btn btn-delete"
                            onClick={(e) => handleDelete(e, file.id)}
                            title="Delete File"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Upload Queue Overlay/Panel */}
        {showQueue && uploads.length > 0 && (
          <div className="upload-queue-panel glass-panel">
            <div className="queue-header">
              <span className="queue-title">Upload Queue ({uploads.length})</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  onClick={handleRemoveFinished}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-indigo)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  title="Clear finished items"
                >
                  Clear Finished
                </button>
                <button className="queue-close-btn" onClick={() => setShowQueue(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="queue-list">
              {uploads.map(upload => (
                <div key={upload.id} className="queue-item">
                  <div className="queue-item-header">
                    <span className="queue-file-name" title={upload.file.name}>
                      {upload.file.name}
                    </span>
                    <div className="queue-item-actions">
                      {upload.status === 'uploading' && (
                        <button className="queue-action-btn" onClick={() => handlePause(upload)} title="Pause Upload">
                          <Pause size={12} />
                        </button>
                      )}
                      {(upload.status === 'paused' || upload.status === 'error') && (
                        <button className="queue-action-btn" onClick={() => handleResume(upload)} title="Resume Upload">
                          <Play size={12} />
                        </button>
                      )}
                      {upload.status !== 'completed' && upload.status !== 'merging' && (
                        <button className="queue-action-btn" onClick={() => handleCancel(upload)} title="Cancel Upload">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="queue-progress-bar-bg">
                    <div 
                      className={`queue-progress-bar-fill status-${upload.status}`}
                      style={{ width: `${upload.progress}%` }}
                    ></div>
                  </div>

                  <div className="queue-item-meta">
                    <span className={`queue-status-text status-${upload.status}`}>
                      {upload.status === 'uploading' && `${upload.progress}% uploaded`}
                      {upload.status === 'paused' && 'Paused'}
                      {upload.status === 'merging' && 'Merging chunks...'}
                      {upload.status === 'completed' && 'Finished'}
                      {upload.status === 'error' && 'Failed'}
                    </span>
                    {upload.status === 'uploading' && (
                      <span>
                        {upload.speed.toFixed(1)} MB/s • ETA {formatETA(upload.eta)}
                      </span>
                    )}
                    {upload.status !== 'uploading' && (
                      <span>{formatBytes(upload.file.size)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed File Preview Modal */}
        {previewFile && (
          <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
            <div className="modal-container glass-panel" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <span className="modal-title-text" title={previewFile.originalName}>
                  {previewFile.originalName}
                </span>
                <button className="modal-close-btn" onClick={() => setPreviewFile(null)}>
                  <X size={18} />
                </button>
              </header>

              <div className="modal-body">
                {previewFile.category === 'images' && (
                  <img 
                    src={`/api/files/download/${previewFile.id}`} 
                    alt={previewFile.originalName} 
                    className="preview-image"
                  />
                )}

                {previewFile.category === 'videos' && (
                  <video 
                    src={`/api/files/download/${previewFile.id}`} 
                    controls 
                    autoPlay
                    className="preview-video"
                  />
                )}

                {previewFile.category === 'audio' && (
                  <div className="preview-audio-container">
                    <div className="audio-disk playing">
                      <Music size={40} />
                    </div>
                    <audio 
                      src={`/api/files/download/${previewFile.id}`} 
                      controls 
                      autoPlay
                      className="preview-audio"
                    />
                  </div>
                )}

                {/* Text documents & code */}
                {(previewFile.mimeType.startsWith('text/') || 
                  previewFile.mimeType === 'application/json' || 
                  previewFile.mimeType === 'application/javascript') && (
                  <pre className="preview-text">
                    {textContent}
                  </pre>
                )}

                {/* Fallback for files that cannot be viewed inline */}
                {previewFile.category !== 'images' && 
                 previewFile.category !== 'videos' && 
                 previewFile.category !== 'audio' && 
                 !previewFile.mimeType.startsWith('text/') && 
                 previewFile.mimeType !== 'application/json' && 
                 previewFile.mimeType !== 'application/javascript' && (
                  <div className="preview-generic">
                    <AlertCircle size={48} className="empty-icon" style={{ color: 'var(--accent-indigo)' }} />
                    <p className="drag-text-main">Preview not supported for this file type</p>
                    <p className="drag-text-sub">
                      Type: {previewFile.mimeType || 'unknown'} • Size: {formatBytes(previewFile.size)}
                    </p>
                  </div>
                )}
              </div>

              <footer className="modal-footer">
                <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <Info size={14} />
                  <span>Uploaded on {new Date(previewFile.uploadDate).toLocaleString()}</span>
                </div>
                <button className="modal-btn" onClick={() => setPreviewFile(null)}>
                  Close
                </button>
                <button 
                  className="modal-btn btn-action"
                  onClick={(e) => handleDownload(e, previewFile)}
                >
                  <Download size={14} />
                  Download File
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* URL Scraper Modal */}
        {showScraper && (
          <div className="modal-overlay" onClick={() => setShowScraper(false)}>
            <div className="modal-container glass-panel" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <span className="modal-title-text">Website Downloader Scraper</span>
                <button className="modal-close-btn" onClick={() => setShowScraper(false)}>
                  <X size={18} />
                </button>
              </header>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'stretch', justifyContent: 'flex-start', maxHeight: '70vh', overflowY: 'auto', textAlign: 'left' }}>
                <p className="drag-text-sub" style={{ fontSize: '0.85rem' }}>
                  Enter a website link below. The Archives will automatically parse it, extracting any safe media, document, or archive downloads while filtering out scripts, executables, or malicious links.
                </p>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="url"
                    className="search-input"
                    placeholder="https://example.com/downloads"
                    value={scraperUrl}
                    onChange={(e) => setScraperUrl(e.target.value)}
                    style={{ paddingLeft: '16px' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleScrape(); }}
                  />
                  <button 
                    className="glow-btn modal-btn btn-action" 
                    onClick={handleScrape}
                    disabled={scraping}
                    style={{ margin: 0, whiteSpace: 'nowrap' }}
                  >
                    {scraping ? 'Scraping...' : 'Scan Link'}
                  </button>
                </div>

                {scraping && (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <RefreshCw className="empty-icon spin" style={{ animation: 'spin 1.5s linear infinite' }} size={32} />
                    <p style={{ fontSize: '0.85rem' }}>Crawling site for safe downloadable contents...</p>
                  </div>
                )}

                {!scraping && scrapedResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px', background: 'rgba(0,0,0,0.1)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Discovered Safe Downloads ({scrapedResults.length})</span>
                    {scrapedResults.map((result, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flexGrow: 1 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={result.fileName}>
                            {result.fileName}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={result.url}>
                            {result.url}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            value={scrapedFolderSelections[result.url] || 'root'}
                            onChange={(e) => setScrapedFolderSelections(prev => ({ ...prev, [result.url]: e.target.value }))}
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--glass-border)',
                              color: '#fff',
                              borderRadius: '4px',
                              padding: '6px 8px',
                              fontSize: '0.75rem',
                              outline: 'none',
                              maxWidth: '120px'
                            }}
                          >
                            <option value="root" style={{ background: '#1e1b4b' }}>Root Folder</option>
                            {allFolders.map(f => (
                              <option key={f.id} value={f.id} style={{ background: '#1e1b4b' }}>{f.name}</option>
                            ))}
                          </select>
                          <button 
                            onClick={() => handleRemoteDownload(result)}
                            className="modal-btn"
                            disabled={downloadingUrls[result.url] === 'downloading' || downloadingUrls[result.url] === 'completed'}
                            style={{ margin: 0, padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {downloadingUrls[result.url] === 'downloading' && (
                              <>
                                <RefreshCw size={10} className="spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                                Saving...
                              </>
                            )}
                            {downloadingUrls[result.url] === 'completed' && (
                              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Saved</span>
                            )}
                            {downloadingUrls[result.url] === 'error' && (
                              <span style={{ color: 'var(--accent-rose)' }}>Retry</span>
                            )}
                            {!downloadingUrls[result.url] && (
                              <>
                                <Download size={10} />
                                Save file
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '10px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>Configure Recurring Scraper Job</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Target URL</span>
                      <input 
                        type="url"
                        className="search-input"
                        placeholder="https://example.com/downloads"
                        value={scraperUrl}
                        onChange={(e) => setScraperUrl(e.target.value)}
                        style={{ paddingLeft: '12px', height: '36px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Destination Folder</span>
                      <select
                        value={scheduleFolderId}
                        onChange={(e) => setScheduleFolderId(e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--glass-border)',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '0 12px',
                          fontSize: '0.85rem',
                          height: '36px',
                          outline: 'none',
                          minWidth: '130px'
                        }}
                      >
                        <option value="root" style={{ background: '#1e1b4b' }}>Root Folder</option>
                        {allFolders.map(f => (
                          <option key={f.id} value={f.id} style={{ background: '#1e1b4b' }}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Frequency</span>
                      <select
                        value={scheduleOption}
                        onChange={(e) => setScheduleOption(e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--glass-border)',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '0 12px',
                          fontSize: '0.85rem',
                          height: '36px',
                          outline: 'none',
                          minWidth: '110px'
                        }}
                      >
                        <option value="once" style={{ background: '#1e1b4b' }}>One-time</option>
                        <option value="weekly" style={{ background: '#1e1b4b' }}>Weekly</option>
                        <option value="monthly" style={{ background: '#1e1b4b' }}>Monthly</option>
                        <option value="quarterly" style={{ background: '#1e1b4b' }}>Quarterly</option>
                      </select>
                    </div>
                    <button 
                      className="glow-btn modal-btn btn-action" 
                      onClick={handleCreateScheduleJob}
                      style={{ margin: 0, alignSelf: 'flex-end', height: '36px' }}
                    >
                      Schedule Scan
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Scraper Schedules ({scraperJobs.length})</span>
                  {scraperJobs.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', padding: '10px', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: '6px' }}>
                      No active schedules. Set up a schedule above to automatically download new files!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {scraperJobs.map(job => {
                        const destFolder = job.folderId ? (allFolders.find(f => f.id === job.folderId)?.name || 'Unknown Folder') : 'Root';
                        return (
                          <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flexGrow: 1 }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={job.url}>
                                  {job.url}
                                </span>
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(99,102,241,0.2)', borderRadius: '12px', color: 'var(--accent-indigo)', textTransform: 'capitalize' }}>
                                  {job.schedule}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                                <span>Destination: <strong style={{ color: 'var(--text-primary)' }}>{destFolder}</strong></span>
                                <span>Last run: {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : 'Never'}</span>
                                {job.active && job.nextRun && <span>Next run: {new Date(job.nextRun).toLocaleDateString()}</span>}
                                {!job.active && <span style={{ color: 'var(--accent-rose)' }}>Finished (One-time)</span>}
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteJob(job.id)}
                              className="file-action-btn btn-delete"
                              title="Delete Scheduled Job"
                              style={{ margin: 0, padding: '6px', minWidth: 'auto' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <footer className="modal-footer">
                <button className="modal-btn" onClick={() => setShowScraper(false)}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
