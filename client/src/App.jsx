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
  Lock,
  Unlock,
  AlertCircle,
  FolderOpen,
  Info,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  ChevronUp,
  ChevronDown,
  ListMusic,
  Tag,
  Radio,
  Share2,
  Copy,
  Sliders,
  Crop,
  Type,
  Edit3,
  Plus,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Save,
  Undo,
  Redo,
  Maximize2
} from 'lucide-react';
import { ChunkUploader } from './utils/chunkUploader';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'http://localhost:5000';

const originalFetch = window.fetch;

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [adminViewTab, setAdminViewTab] = useState('users');
  
  // Vault state variables
  const [vaultPassword, setVaultPassword] = useState('');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [isVaultInitialized, setIsVaultInitialized] = useState(true);
  const [vaultUnlockInput, setVaultUnlockInput] = useState('');
  const [vaultConfirmInput, setVaultConfirmInput] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [vaultSuccess, setVaultSuccess] = useState('');

  // Admin form states
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedUserIdForPasswordReset, setSelectedUserIdForPasswordReset] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // g00j Key state variables
  const [loginMode, setLoginMode] = useState('login'); // 'login', 'signup', 'reset'
  const [signupUsername, setSignupUsername] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupG00jKey, setSignupG00jKey] = useState('');
  const [signupRole, setSignupRole] = useState('user');

  const [resetUsername, setResetUsername] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetG00jKey, setResetG00jKey] = useState('');

  const [g00jKeysList, setG00jKeysList] = useState([]);
  const [newG00jKeyDesc, setNewG00jKeyDesc] = useState('');

  // Vault key rotation state variables
  const [showChangeVaultPasswordModal, setShowChangeVaultPasswordModal] = useState(false);
  const [newVaultPasswordInput, setNewVaultPasswordInput] = useState('');
  const [confirmNewVaultPasswordInput, setConfirmNewVaultPasswordInput] = useState('');
  const [vaultRotationError, setVaultRotationError] = useState('');
  const [vaultRotationSuccess, setVaultRotationSuccess] = useState('');

  // Override window.fetch to inject Authorization Bearer token automatically
  window.fetch = async (url, options = {}) => {
    const isApi = url.toString().startsWith(API_BASE) || url.toString().startsWith('/api');
    if (isApi && token) {
      const headers = options.headers ? { ...options.headers } : {};
      headers['Authorization'] = `Bearer ${token}`;
      if (vaultPassword) {
        headers['X-Vault-Key'] = vaultPassword;
      }
      options = { ...options, headers };
    }
    const response = await originalFetch(url, options);
    if (response.status === 401 && isApi && !url.toString().includes('/api/auth/login')) {
      localStorage.removeItem('token');
      setToken('');
      setCurrentUser(null);
      setVaultPassword('');
      setIsVaultUnlocked(false);
    }
    return response;
  };

  const getFileDownloadUrl = (file, isDownload = false) => {
    if (!file) return '';
    let url = `${API_BASE}/api/files/download/${file.id}`;
    const params = [];
    if (isDownload) {
      params.push('download=true');
    }
    if (file.isVault && vaultPassword) {
      params.push(`vaultKey=${encodeURIComponent(vaultPassword)}`);
    }
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    return url;
  };

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

  // YouTube Music style persistent audio states
  const [activeAudioTrack, setActiveAudioTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [audioQueue, setAudioQueue] = useState([]);
  const audioRef = useRef(null);

  // Expandable player, lyrics & queue states
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [activePlayerTab, setActivePlayerTab] = useState('queue'); // queue or lyrics
  const [lyricsText, setLyricsText] = useState('');
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  // Audio Tagger states
  const [taggerFile, setTaggerFile] = useState(null);
  const [taggerTags, setTaggerTags] = useState({
    title: '',
    artist: '',
    album: '',
    year: '',
    genre: '',
    trackNumber: '',
    albumArtist: '',
    composer: '',
    publisher: '',
    bpm: '',
    discNumber: '',
    comment: '',
    coverArtUrl: ''
  });
  const [taggerCoverArt, setTaggerCoverArt] = useState(null); // base64 current
  const [mbSearchQuery, setMbSearchQuery] = useState('');
  const [mbResults, setMbResults] = useState([]);
  const [searchingMb, setSearchingMb] = useState(false);
  const [selectedMbMatch, setSelectedMbMatch] = useState(null);
  const [loadingTaggerData, setLoadingTaggerData] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [mbCoverUrl, setMbCoverUrl] = useState(null); // cover art of selected match
  const [fetchingMbCover, setFetchingMbCover] = useState(false);
  const [showArchivesPicker, setShowArchivesPicker] = useState(false);
  const [archivesImages, setArchivesImages] = useState([]);
  const [loadingArchivesImages, setLoadingArchivesImages] = useState(false);

  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [distributeFile, setDistributeFile] = useState(null);
  const [distributeTags, setDistributeTags] = useState(null);
  const [loadingDistributeData, setLoadingDistributeData] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareTarget, setShareTarget] = useState(null); // file or folder
  const [shareTargetType, setShareTargetType] = useState('file'); // 'file' or 'folder'
  const [sharedFileId, setSharedFileId] = useState(null);
  const [sharedFile, setSharedFile] = useState(null);
  const [loadingSharedFile, setLoadingSharedFile] = useState(false);
  const [sharedFileError, setSharedFileError] = useState(null);
  const [sharedFolderRootId, setSharedFolderRootId] = useState(null);
  const [sharedFolderRoot, setSharedFolderRoot] = useState(null);

  // Image Editor States
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editorFile, setEditorFile] = useState(null);
  const [imageObj, setImageObj] = useState(null);
  const [editorActiveTab, setEditorActiveTab] = useState('adjust');
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const canvasRef = useRef(null);

  // Adjustments states
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [exposure, setExposure] = useState(100);
  const [hue, setHue] = useState(0);
  const [blur, setBlur] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [warmth, setWarmth] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('none');

  // Brush / Drawing states
  const [brushMode, setBrushMode] = useState('off'); // 'off', 'draw', 'erase'
  const [brushColor, setBrushColor] = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [drawings, setDrawings] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Texts states
  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textFont, setTextFont] = useState('Outfit');
  const [textSize, setTextSize] = useState(36);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textAngle, setTextAngle] = useState(0);
  const [textOpacity, setTextOpacity] = useState(100);
  const [textBorderWidth, setTextBorderWidth] = useState(0);
  const [textBorderColor, setTextBorderColor] = useState('#000000');

  // Shapes & Stickers states
  const [shapes, setShapes] = useState([]);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [shapeStrokeColor, setShapeStrokeColor] = useState('#6366f1');
  const [shapeFillColor, setShapeFillColor] = useState('transparent');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(4);
  const [stickerOpacity, setStickerOpacity] = useState(100);
  const [stickerRotation, setStickerRotation] = useState(0);

  // Resizer states
  const [resizeWidth, setResizeWidth] = useState(800);
  const [resizeHeight, setResizeHeight] = useState(600);
  const [aspectRatioLock, setAspectRatioLock] = useState(true);

  // Output / Save states
  const [jpegQuality, setJpegQuality] = useState(0.9);
  const [saveFormat, setSaveFormat] = useState('png'); // 'png' or 'jpeg'
  const [saveAsCopy, setSaveAsCopy] = useState(true);
  const [newFileName, setNewFileName] = useState('');
  const [editorSaving, setEditorSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState('0 KB');

  // History stack
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragTarget, setDragTarget] = useState(null);

  const getAdjustmentsState = () => ({
    brightness, contrast, saturation, exposure, hue, blur, opacity, warmth, selectedFilter
  });

  // Load base image when modal opens
  useEffect(() => {
    if (showImageEditor && editorFile) {
      setEditorSaving(false);
      setSaveModalOpen(false);
      setSaveAsCopy(true);
      
      const cleanName = editorFile.originalName.replace(/\.[^/.]+$/, "");
      const ext = editorFile.originalName.split('.').pop() || 'png';
      setNewFileName(`${cleanName}_edited.${ext}`);
      setSaveFormat(ext.toLowerCase() === 'png' ? 'png' : 'jpeg');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getFileDownloadUrl(editorFile) + (getFileDownloadUrl(editorFile).includes('?') ? '&' : '?') + 't=' + Date.now();
      img.onload = () => {
        setImageObj(img);
        setCanvasWidth(img.width);
        setCanvasHeight(img.height);
        setResizeWidth(img.width);
        setResizeHeight(img.height);
        
        // Setup initial history state
        const initial = {
          width: img.width,
          height: img.height,
          drawings: [],
          texts: [],
          shapes: [],
          adjustments: {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            exposure: 100,
            hue: 0,
            blur: 0,
            opacity: 100,
            warmth: 0,
            selectedFilter: 'none'
          }
        };
        setHistory([initial]);
        setHistoryIndex(0);
        setDrawings([]);
        setTexts([]);
        setShapes([]);
        setBrightness(100);
        setContrast(100);
        setSaturation(100);
        setExposure(100);
        setHue(0);
        setBlur(0);
        setOpacity(100);
        setWarmth(0);
        setSelectedFilter('none');
        setSelectedTextId(null);
        setSelectedStickerId(null);
        setBrushMode('off');
      };
    }
  }, [showImageEditor, editorFile]);

  // History stack push
  const pushHistory = (newDrawings, newTexts, newShapes, newAdjustments, newWidth, newHeight) => {
    const nextState = {
      width: newWidth || canvasWidth,
      height: newHeight || canvasHeight,
      drawings: JSON.parse(JSON.stringify(newDrawings)),
      texts: JSON.parse(JSON.stringify(newTexts)),
      shapes: JSON.parse(JSON.stringify(newShapes)),
      adjustments: { ...newAdjustments }
    };
    const updatedHistory = history.slice(0, historyIndex + 1);
    setHistory([...updatedHistory, nextState]);
    setHistoryIndex(updatedHistory.length);
  };

  const applyHistoryState = (state) => {
    setCanvasWidth(state.width);
    setCanvasHeight(state.height);
    setResizeWidth(state.width);
    setResizeHeight(state.height);
    setDrawings(state.drawings);
    setTexts(state.texts);
    setShapes(state.shapes);
    const adj = state.adjustments;
    setBrightness(adj.brightness);
    setContrast(adj.contrast);
    setSaturation(adj.saturation);
    setExposure(adj.exposure);
    setHue(adj.hue);
    setBlur(adj.blur);
    setOpacity(adj.opacity);
    setWarmth(adj.warmth);
    setSelectedFilter(adj.selectedFilter);
    setSelectedTextId(null);
    setSelectedStickerId(null);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      applyHistoryState(history[prevIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      applyHistoryState(history[nextIndex]);
    }
  };

  const handleResetEditor = () => {
    if (history.length > 0) {
      setHistoryIndex(0);
      applyHistoryState(history[0]);
    }
  };

  // Image Transformations (Rotate, Flips, Crop)
  const handleRotateImage = () => {
    if (!imageObj) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasHeight;
    tempCanvas.height = canvasWidth;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.translate(canvasHeight / 2, canvasWidth / 2);
    tempCtx.rotate(Math.PI / 2);
    tempCtx.drawImage(imageObj, -canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);
    
    const rotatedSrc = tempCanvas.toDataURL();
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    newImg.src = rotatedSrc;
    newImg.onload = () => {
      setImageObj(newImg);
      const prevWidth = canvasWidth;
      const prevHeight = canvasHeight;
      setCanvasWidth(prevHeight);
      setCanvasHeight(prevWidth);
      setResizeWidth(prevHeight);
      setResizeHeight(prevWidth);
      
      const rotatedDrawings = drawings.map(path => ({
        ...path,
        points: path.points.map(p => ({ x: prevHeight - p.y, y: p.x }))
      }));
      
      const rotatedTexts = texts.map(t => ({
        ...t,
        x: prevHeight - t.y,
        y: t.x,
        angle: ((t.angle || 0) + 90) % 360
      }));
      
      const rotatedShapes = shapes.map(s => ({
        ...s,
        x: prevHeight - (s.y + s.height),
        y: s.x,
        width: s.height,
        height: s.width,
        angle: ((s.angle || 0) + 90) % 360
      }));
      
      setDrawings(rotatedDrawings);
      setTexts(rotatedTexts);
      setShapes(rotatedShapes);
      
      pushHistory(rotatedDrawings, rotatedTexts, rotatedShapes, getAdjustmentsState(), prevHeight, prevWidth);
    };
  };

  const handleFlipHorizontal = () => {
    if (!imageObj) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.translate(canvasWidth, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(imageObj, 0, 0, canvasWidth, canvasHeight);
    
    const flippedSrc = tempCanvas.toDataURL();
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    newImg.src = flippedSrc;
    newImg.onload = () => {
      setImageObj(newImg);
      
      const flippedDrawings = drawings.map(path => ({
        ...path,
        points: path.points.map(p => ({ x: canvasWidth - p.x, y: p.y }))
      }));
      
      const flippedTexts = texts.map(t => ({
        ...t,
        x: canvasWidth - t.x,
        angle: (360 - (t.angle || 0)) % 360
      }));
      
      const flippedShapes = shapes.map(s => ({
        ...s,
        x: canvasWidth - s.x - s.width,
        angle: (360 - (s.angle || 0)) % 360
      }));
      
      setDrawings(flippedDrawings);
      setTexts(flippedTexts);
      setShapes(flippedShapes);
      
      pushHistory(flippedDrawings, flippedTexts, flippedShapes, getAdjustmentsState());
    };
  };

  const handleFlipVertical = () => {
    if (!imageObj) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.translate(0, canvasHeight);
    tempCtx.scale(1, -1);
    tempCtx.drawImage(imageObj, 0, 0, canvasWidth, canvasHeight);
    
    const flippedSrc = tempCanvas.toDataURL();
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    newImg.src = flippedSrc;
    newImg.onload = () => {
      setImageObj(newImg);
      
      const flippedDrawings = drawings.map(path => ({
        ...path,
        points: path.points.map(p => ({ x: p.x, y: canvasHeight - p.y }))
      }));
      
      const flippedTexts = texts.map(t => ({
        ...t,
        y: canvasHeight - t.y,
        angle: (360 - (t.angle || 0)) % 360
      }));
      
      const flippedShapes = shapes.map(s => ({
        ...s,
        y: canvasHeight - s.y - s.height,
        angle: (360 - (s.angle || 0)) % 360
      }));
      
      setDrawings(flippedDrawings);
      setTexts(flippedTexts);
      setShapes(flippedShapes);
      
      pushHistory(flippedDrawings, flippedTexts, flippedShapes, getAdjustmentsState());
    };
  };

  const handleCropImage = (ratioName) => {
    if (!imageObj) return;
    
    let ratio = 1;
    if (ratioName === '1:1') ratio = 1;
    else if (ratioName === '4:3') ratio = 4/3;
    else if (ratioName === '16:9') ratio = 16/9;
    else if (ratioName === '3:2') ratio = 3/2;
    else return;
    
    const W = canvasWidth;
    const H = canvasHeight;
    let cropW, cropH;
    
    if (W / H > ratio) {
      cropH = H;
      cropW = H * ratio;
    } else {
      cropW = W;
      cropH = W / ratio;
    }
    
    const cropX = (W - cropW) / 2;
    const cropY = (H - cropH) / 2;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(imageObj, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    
    const croppedSrc = tempCanvas.toDataURL();
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    newImg.src = croppedSrc;
    newImg.onload = () => {
      setImageObj(newImg);
      setCanvasWidth(cropW);
      setCanvasHeight(cropH);
      setResizeWidth(cropW);
      setResizeHeight(cropH);
      
      const croppedDrawings = drawings.map(path => ({
        ...path,
        points: path.points
          .map(p => ({ x: p.x - cropX, y: p.y - cropY }))
          .filter(p => p.x >= 0 && p.x <= cropW && p.y >= 0 && p.y <= cropH)
      })).filter(path => path.points.length > 0);
      
      const croppedTexts = texts.map(t => ({
        ...t,
        x: t.x - cropX,
        y: t.y - cropY
      })).filter(t => t.x >= -50 && t.x <= cropW + 50 && t.y >= -50 && t.y <= cropH + 50);
      
      const croppedShapes = shapes.map(s => ({
        ...s,
        x: s.x - cropX,
        y: s.y - cropY
      })).filter(s => s.x >= -s.width && s.x <= cropW && s.y >= -s.height && s.y <= cropH);
      
      setDrawings(croppedDrawings);
      setTexts(croppedTexts);
      setShapes(croppedShapes);
      
      pushHistory(croppedDrawings, croppedTexts, croppedShapes, getAdjustmentsState(), cropW, cropH);
    };
  };

  // Picture Resizer Studio
  const handleResizeWidthChange = (val) => {
    setResizeWidth(val);
    if (aspectRatioLock && val && canvasWidth) {
      const ratio = canvasHeight / canvasWidth;
      setResizeHeight(Math.round(val * ratio));
    }
  };

  const handleResizeHeightChange = (val) => {
    setResizeHeight(val);
    if (aspectRatioLock && val && canvasHeight) {
      const ratio = canvasWidth / canvasHeight;
      setResizeWidth(Math.round(val * ratio));
    }
  };

  const applyPercentScale = (pct) => {
    const newW = Math.round(canvasWidth * (pct / 100));
    const newH = Math.round(canvasHeight * (pct / 100));
    setResizeWidth(newW);
    setResizeHeight(newH);
  };

  const handleApplyResize = () => {
    if (!imageObj) return;
    
    const newW = parseInt(resizeWidth);
    const newH = parseInt(resizeHeight);
    if (isNaN(newW) || isNaN(newH) || newW <= 0 || newH <= 0) {
      alert('Please enter valid dimensions.');
      return;
    }
    
    const oldW = canvasWidth;
    const oldH = canvasHeight;
    const scaleFactorX = newW / oldW;
    const scaleFactorY = newH / oldH;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newW;
    tempCanvas.height = newH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(imageObj, 0, 0, oldW, oldH, 0, 0, newW, newH);
    
    const resizedSrc = tempCanvas.toDataURL();
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    newImg.src = resizedSrc;
    newImg.onload = () => {
      setImageObj(newImg);
      setCanvasWidth(newW);
      setCanvasHeight(newH);
      
      const scaledDrawings = drawings.map(path => ({
        ...path,
        size: path.size * (scaleFactorX + scaleFactorY) / 2,
        points: path.points.map(p => ({ x: p.x * scaleFactorX, y: p.y * scaleFactorY }))
      }));
      
      const scaledTexts = texts.map(t => ({
        ...t,
        x: t.x * scaleFactorX,
        y: t.y * scaleFactorY,
        fontSize: Math.round(t.fontSize * scaleFactorX),
        borderWidth: t.borderWidth * scaleFactorX
      }));
      
      const scaledShapes = shapes.map(s => ({
        ...s,
        x: s.x * scaleFactorX,
        y: s.y * scaleFactorY,
        width: s.width * scaleFactorX,
        height: s.height * scaleFactorY,
        strokeWidth: s.strokeWidth * (scaleFactorX + scaleFactorY) / 2
      }));
      
      setDrawings(scaledDrawings);
      setTexts(scaledTexts);
      setShapes(scaledShapes);
      
      pushHistory(scaledDrawings, scaledTexts, scaledShapes, getAdjustmentsState(), newW, newH);
      alert('Resolution scaled successfully!');
    };
  };

  // Canvas Vector Elements adding
  const handleAddText = () => {
    if (!inputText.trim()) return;
    const id = Date.now().toString() + Math.random().toString().substr(2, 5);
    const newText = {
      id,
      text: inputText.trim(),
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      color: textColor,
      fontSize: textSize,
      fontFamily: textFont,
      bold: textBold,
      italic: textItalic,
      angle: textAngle,
      opacity: textOpacity,
      borderWidth: textBorderWidth,
      borderColor: textBorderColor
    };
    const updated = [...texts, newText];
    setTexts(updated);
    setInputText('');
    setSelectedTextId(id);
    setSelectedStickerId(null);
    pushHistory(drawings, updated, shapes, getAdjustmentsState());
  };

  const updateSelectedText = (key, val) => {
    if (!selectedTextId) return;
    const updated = texts.map(t => {
      if (t.id === selectedTextId) {
        return { ...t, [key]: val };
      }
      return t;
    });
    setTexts(updated);
  };

  const commitSelectedTextHistory = () => {
    pushHistory(drawings, texts, shapes, getAdjustmentsState());
  };

  const handleAddShape = (type) => {
    const id = Date.now().toString() + Math.random().toString().substr(2, 5);
    const newShape = {
      id,
      type,
      x: canvasWidth / 2 - 50,
      y: canvasHeight / 2 - 50,
      width: 100,
      height: 100,
      strokeColor: shapeStrokeColor,
      fillColor: shapeFillColor,
      strokeWidth: shapeStrokeWidth,
      opacity: 100,
      angle: 0
    };
    const updated = [...shapes, newShape];
    setShapes(updated);
    setSelectedStickerId(id);
    setSelectedTextId(null);
    setEditorActiveTab('shapes');
    pushHistory(drawings, texts, updated, getAdjustmentsState());
  };

  const handleAddSticker = (emoji) => {
    const id = Date.now().toString() + Math.random().toString().substr(2, 5);
    const newSticker = {
      id,
      type: emoji,
      x: canvasWidth / 2 - 40,
      y: canvasHeight / 2 - 40,
      width: 80,
      height: 80,
      strokeColor: 'transparent',
      fillColor: 'transparent',
      strokeWidth: 0,
      opacity: 100,
      angle: 0
    };
    const updated = [...shapes, newSticker];
    setShapes(updated);
    setSelectedStickerId(id);
    setSelectedTextId(null);
    setEditorActiveTab('shapes');
    pushHistory(drawings, texts, updated, getAdjustmentsState());
  };

  const updateSelectedShape = (key, val) => {
    if (!selectedStickerId) return;
    const updated = shapes.map(s => {
      if (s.id === selectedStickerId) {
        return { ...s, [key]: val };
      }
      return s;
    });
    setShapes(updated);
  };

  const commitSelectedShapeHistory = () => {
    pushHistory(drawings, texts, shapes, getAdjustmentsState());
  };

  // Canvas Mouse Interactions
  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Check text bounds first
    for (let i = texts.length - 1; i >= 0; i--) {
      const text = texts[i];
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.font = `${text.italic ? 'italic ' : ''}${text.bold ? 'bold ' : ''}${text.fontSize}px ${text.fontFamily || 'Outfit'}`;
      const metrics = ctx.measureText(text.text);
      const textW = metrics.width + 16;
      const textH = text.fontSize + 16;
      ctx.restore();
      
      const rad = (text.angle || 0) * Math.PI / 180;
      const btnRelX = -textW / 2;
      const btnRelY = -textH / 2;
      const btnAbsX = text.x + btnRelX * Math.cos(rad) - btnRelY * Math.sin(rad);
      const btnAbsY = text.y + btnRelX * Math.sin(rad) + btnRelY * Math.cos(rad);
      
      const dist = Math.hypot(mouseX - btnAbsX, mouseY - btnAbsY);
      if (dist < 15 && text.id === selectedTextId) {
        const updated = texts.filter(t => t.id !== text.id);
        setTexts(updated);
        setSelectedTextId(null);
        pushHistory(drawings, updated, shapes, getAdjustmentsState());
        return;
      }
      
      const dx = mouseX - text.x;
      const dy = mouseY - text.y;
      const relX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
      const relY = dx * Math.sin(-rad) + dy * Math.cos(-rad);
      
      if (relX >= -textW / 2 && relX <= textW / 2 && relY >= -textH / 2 && relY <= textH / 2) {
        setSelectedTextId(text.id);
        setSelectedStickerId(null);
        setEditorActiveTab('text');
        setDragTarget({
          type: 'text',
          id: text.id,
          clickX: mouseX,
          clickY: mouseY,
          startX: text.x,
          startY: text.y
        });
        return;
      }
    }
    
    // Check shapes bounds next
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      const rad = (shape.angle || 0) * Math.PI / 180;
      
      const btnRelX = -shape.width / 2 - 8;
      const btnRelY = -shape.height / 2 - 8;
      const btnAbsX = cx + btnRelX * Math.cos(rad) - btnRelY * Math.sin(rad);
      const btnAbsY = cy + btnRelX * Math.sin(rad) + btnRelY * Math.cos(rad);
      
      const dist = Math.hypot(mouseX - btnAbsX, mouseY - btnAbsY);
      if (dist < 15 && shape.id === selectedStickerId) {
        const updated = shapes.filter(s => s.id !== shape.id);
        setShapes(updated);
        setSelectedStickerId(null);
        pushHistory(drawings, texts, updated, getAdjustmentsState());
        return;
      }
      
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const relX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
      const relY = dx * Math.sin(-rad) + dy * Math.cos(-rad);
      
      if (relX >= -shape.width / 2 && relX <= shape.width / 2 && relY >= -shape.height / 2 && relY <= shape.height / 2) {
        setSelectedStickerId(shape.id);
        setSelectedTextId(null);
        setEditorActiveTab('shapes');
        setDragTarget({
          type: 'shape',
          id: shape.id,
          clickX: mouseX,
          clickY: mouseY,
          startX: shape.x,
          startY: shape.y
        });
        return;
      }
    }
    
    // Drawing Brush Stroke trigger
    if (brushMode !== 'off') {
      setIsDrawing(true);
      const strokePoint = { x: mouseX, y: mouseY };
      const newPath = {
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
        isEraser: brushMode === 'erase',
        points: [strokePoint]
      };
      setCurrentPath(newPath);
    } else {
      setSelectedTextId(null);
      setSelectedStickerId(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    if (isDrawing && currentPath) {
      setCurrentPath({
        ...currentPath,
        points: [...currentPath.points, { x: mouseX, y: mouseY }]
      });
    } else if (dragTarget) {
      const dx = mouseX - dragTarget.clickX;
      const dy = mouseY - dragTarget.clickY;
      
      if (dragTarget.type === 'text') {
        const updated = texts.map(t => {
          if (t.id === dragTarget.id) {
            return {
              ...t,
              x: dragTarget.startX + dx,
              y: dragTarget.startY + dy
            };
          }
          return t;
        });
        setTexts(updated);
      } else if (dragTarget.type === 'shape') {
        const updated = shapes.map(s => {
          if (s.id === dragTarget.id) {
            return {
              ...s,
              x: dragTarget.startX + dx,
              y: dragTarget.startY + dy
            };
          }
          return s;
        });
        setShapes(updated);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentPath) {
      const updated = [...drawings, currentPath];
      setDrawings(updated);
      setCurrentPath(null);
      setIsDrawing(false);
      pushHistory(updated, texts, shapes, getAdjustmentsState());
    } else if (dragTarget) {
      pushHistory(drawings, texts, shapes, getAdjustmentsState());
      setDragTarget(null);
    }
  };

  // Draw Lifecycle
  const drawCanvas = () => {
    if (!canvasRef.current || !imageObj) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw base image with filters
    ctx.save();
    
    const totalBrightness = (brightness / 100) * (exposure / 100) * 100;
    let filterString = `brightness(${totalBrightness}%) contrast(${contrast}%) saturate(${saturation}%) opacity(${opacity}%) hue-rotate(${hue}deg) blur(${blur}px)`;
    
    if (selectedFilter === 'sepia') filterString += ' sepia(80%)';
    else if (selectedFilter === 'grayscale') filterString += ' grayscale(100%)';
    else if (selectedFilter === 'invert') filterString += ' invert(100%)';
    else if (selectedFilter === 'vintage') filterString += ' sepia(40%) saturate(120%) hue-rotate(-10deg)';
    else if (selectedFilter === 'retro') filterString += ' contrast(120%) saturate(150%) hue-rotate(10deg)';
    else if (selectedFilter === 'cool') filterString += ' hue-rotate(20deg) saturate(90%) brightness(105%)';
    else if (selectedFilter === 'warm') filterString += ' hue-rotate(-20deg) saturate(110%) brightness(105%)';
    else if (selectedFilter === 'noir') filterString += ' grayscale(100%) contrast(140%)';
    
    ctx.filter = filterString;
    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    // Warmth / Tint overlay drawing
    if (warmth !== 0) {
      ctx.save();
      if (warmth > 0) {
        ctx.fillStyle = `rgba(255, 140, 0, ${warmth / 350})`; // warm sunlight orange
      } else {
        ctx.fillStyle = `rgba(0, 191, 255, ${Math.abs(warmth) / 350})`; // cool sunlight blue
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    
    // Draw drawings paths (supports composite transparent mask for eraser strokes)
    if (drawings.length > 0 || currentPath) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      const drawStroke = (ctxTarget, path) => {
        ctxTarget.save();
        if (path.isEraser) {
          ctxTarget.globalCompositeOperation = 'destination-out';
          ctxTarget.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctxTarget.strokeStyle = path.color;
        }
        ctxTarget.globalAlpha = (path.opacity || 100) / 100;
        ctxTarget.lineWidth = path.size;
        ctxTarget.lineCap = 'round';
        ctxTarget.lineJoin = 'round';
        ctxTarget.beginPath();
        if (path.points.length > 0) {
          ctxTarget.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
            ctxTarget.lineTo(path.points[i].x, path.points[i].y);
          }
          ctxTarget.stroke();
        }
        ctxTarget.restore();
      };
      
      drawings.forEach(path => drawStroke(tempCtx, path));
      if (currentPath) {
        drawStroke(tempCtx, currentPath);
      }
      
      ctx.drawImage(tempCanvas, 0, 0);
    }
    
    // Draw Shapes
    shapes.forEach(shape => {
      ctx.save();
      ctx.globalAlpha = (shape.opacity || 100) / 100;
      
      const cx = shape.x + shape.width / 2;
      const cy = shape.y + shape.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((shape.angle || 0) * Math.PI / 180);
      ctx.translate(-cx, -cy);
      
      ctx.lineWidth = shape.strokeWidth;
      ctx.strokeStyle = shape.strokeColor;
      ctx.fillStyle = shape.fillColor;
      
      if (shape.type === 'rect') {
        if (shape.fillColor !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        if (shape.strokeWidth > 0) {
          ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        const rx = Math.abs(shape.width) / 2;
        ctx.arc(cx, cy, rx, 0, 2 * Math.PI);
        if (shape.fillColor !== 'transparent') {
          ctx.fill();
        }
        if (shape.strokeWidth > 0) {
          ctx.stroke();
        }
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.stroke();
        
        if (shape.type === 'arrow') {
          const angle = Math.atan2(shape.height, shape.width);
          const endX = shape.x + shape.width;
          const endY = shape.y + shape.height;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - 15 * Math.cos(angle - Math.PI / 6), endY - 15 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(endX - 15 * Math.cos(angle + Math.PI / 6), endY - 15 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = shape.strokeColor;
          ctx.fill();
        }
      } else {
        ctx.font = `${Math.abs(shape.width)}px ${textFont || 'Outfit'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shape.type, cx, cy);
      }
      ctx.restore();
    });
    
    // Draw Texts
    texts.forEach(text => {
      ctx.save();
      ctx.globalAlpha = (text.opacity || 100) / 100;
      
      ctx.translate(text.x, text.y);
      ctx.rotate((text.angle || 0) * Math.PI / 180);
      
      ctx.font = `${text.italic ? 'italic ' : ''}${text.bold ? 'bold ' : ''}${text.fontSize}px ${text.fontFamily || 'Outfit'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (text.borderWidth > 0) {
        ctx.strokeStyle = text.borderColor || '#000000';
        ctx.lineWidth = text.borderWidth;
        ctx.strokeText(text.text, 0, 0);
      }
      
      ctx.fillStyle = text.color || '#ffffff';
      ctx.fillText(text.text, 0, 0);
      ctx.restore();
    });
    
    // Selection outlined dashed lines around selected elements
    if (selectedTextId) {
      const text = texts.find(t => t.id === selectedTextId);
      if (text) {
        ctx.save();
        ctx.font = `${text.italic ? 'italic ' : ''}${text.bold ? 'bold ' : ''}${text.fontSize}px ${text.fontFamily || 'Outfit'}`;
        const metrics = ctx.measureText(text.text);
        const textW = metrics.width + 16;
        const textH = text.fontSize + 16;
        
        ctx.translate(text.x, text.y);
        ctx.rotate((text.angle || 0) * Math.PI / 180);
        
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'var(--accent-indigo)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-textW / 2, -textH / 2, textW, textH);
        
        ctx.fillStyle = 'var(--accent-rose)';
        ctx.beginPath();
        ctx.arc(-textW / 2, -textH / 2, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', -textW / 2, -textH / 2);
        
        ctx.restore();
      }
    }
    
    if (selectedStickerId) {
      const shape = shapes.find(s => s.id === selectedStickerId);
      if (shape) {
        ctx.save();
        const cx = shape.x + shape.width / 2;
        const cy = shape.y + shape.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((shape.angle || 0) * Math.PI / 180);
        
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'var(--accent-indigo)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-shape.width / 2 - 8, -shape.height / 2 - 8, shape.width + 16, shape.height + 16);
        
        ctx.fillStyle = 'var(--accent-rose)';
        ctx.beginPath();
        ctx.arc(-shape.width / 2 - 8, -shape.height / 2 - 8, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×', -shape.width / 2 - 8, -shape.height / 2 - 8);
        
        ctx.restore();
      }
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [
    imageObj, canvasWidth, canvasHeight, drawings, currentPath, texts, shapes,
    selectedTextId, selectedStickerId, brightness, contrast, saturation,
    exposure, hue, blur, opacity, warmth, selectedFilter
  ]);

  // Estimate JPEG compression output size
  useEffect(() => {
    if (saveModalOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const mime = saveFormat === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mime, jpegQuality);
      const size = Math.round((dataUrl.split(',')[1].length) * 3 / 4);
      setEstimatedSize(formatBytes(size));
    }
  }, [saveModalOpen, saveFormat, jpegQuality]);

  const handleSaveImage = async () => {
    if (!canvasRef.current || !editorFile) return;
    setEditorSaving(true);
    try {
      const canvas = canvasRef.current;
      const mime = saveFormat === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mime, jpegQuality);
      
      const payload = {
        fileName: saveAsCopy ? newFileName : editorFile.originalName,
        imageData: dataUrl,
        saveAsCopy
      };
      
      const response = await fetch(`${API_BASE}/api/files/${editorFile.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        alert('Image edited successfully!');
        setShowImageEditor(false);
        fetchFiles();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to save edits');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving edits');
    } finally {
      setEditorSaving(false);
      setSaveModalOpen(false);
    }
  };

  const handleLocalDownload = () => {
    if (!canvasRef.current || !editorFile) return;
    const canvas = canvasRef.current;
    const mime = saveFormat === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, jpegQuality);
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = saveAsCopy ? newFileName : editorFile.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openDistribute = async (file) => {
    setDistributeFile(file);
    setDistributeTags(null);
    setShowDistributeModal(true);
    setLoadingDistributeData(true);
    try {
      const response = await fetch(`${API_BASE}/api/files/${file.id}/metadata`);
      if (response.ok) {
        const data = await response.json();
        setDistributeTags(data.tags);
      }
    } catch (err) {
      console.error('Failed to fetch metadata for distribution:', err);
    } finally {
      setLoadingDistributeData(false);
    }
  };

  const openTagger = async (file) => {
    setTaggerFile(file);
    setTaggerTags({
      title: '',
      artist: '',
      album: '',
      year: '',
      genre: '',
      trackNumber: '',
      albumArtist: '',
      composer: '',
      publisher: '',
      bpm: '',
      discNumber: '',
      comment: '',
      coverArtUrl: ''
    });
    setTaggerCoverArt(null);
    setSelectedMbMatch(null);
    setMbResults([]);
    setMbCoverUrl(null);

    const cleanName = file.originalName.replace(/\.[^/.]+$/, "").trim();
    setMbSearchQuery(cleanName);
    setLoadingTaggerData(true);

    try {
      const response = await fetch(`${API_BASE}/api/files/${file.id}/metadata`);
      if (response.ok) {
        const data = await response.json();
        setTaggerTags({
          title: data.tags.title || '',
          artist: data.tags.artist || '',
          album: data.tags.album || '',
          year: data.tags.year || '',
          genre: data.tags.genre || '',
          trackNumber: data.tags.trackNumber || '',
          albumArtist: data.tags.albumArtist || '',
          composer: data.tags.composer || '',
          publisher: data.tags.publisher || '',
          bpm: data.tags.bpm || '',
          discNumber: data.tags.discNumber || '',
          comment: data.tags.comment || '',
          coverArtUrl: ''
        });
        setTaggerCoverArt(data.coverArt);
      }
    } catch (err) {
      console.error('Failed to fetch file metadata for tagger:', err);
    } finally {
      setLoadingTaggerData(false);
    }
  };

  const handleMbSearch = async () => {
    if (!mbSearchQuery.trim()) return;
    setSearchingMb(true);
    setSelectedMbMatch(null);
    setMbCoverUrl(null);
    try {
      const response = await fetch(`${API_BASE}/api/musicbrainz/search?q=${encodeURIComponent(mbSearchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setMbResults(data);
      }
    } catch (err) {
      console.error('MusicBrainz search error:', err);
    } finally {
      setSearchingMb(false);
    }
  };

  const handleSelectMbMatch = async (match) => {
    setSelectedMbMatch(match);
    setMbCoverUrl(null);
    if (match.releases && match.releases.length > 0) {
      setFetchingMbCover(true);
      try {
        const release = match.releases[0];
        const res = await fetch(`${API_BASE}/api/musicbrainz/cover/${release.id}`);
        if (res.ok) {
          const data = await res.json();
          setMbCoverUrl(data.coverUrl);
        }
      } catch (err) {
        console.error('Cover art fetch error:', err);
      } finally {
        setFetchingMbCover(false);
      }
    }
  };

  const applyMbMatch = () => {
    if (!selectedMbMatch) return;
    const release = selectedMbMatch.releases?.[0] || {};
    setTaggerTags(prev => ({
      ...prev,
      title: selectedMbMatch.title || prev.title,
      artist: selectedMbMatch.artist || prev.artist,
      album: release.title || prev.album,
      year: release.date ? release.date.substring(0, 4) : prev.year,
      coverArtUrl: mbCoverUrl || prev.coverArtUrl,
      albumArtist: selectedMbMatch.artist || prev.albumArtist
    }));
  };

  const handleSaveTags = async () => {
    setSavingTags(true);
    try {
      const response = await fetch(`${API_BASE}/api/files/${taggerFile.id}/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taggerTags)
      });
      if (response.ok) {
        fetchFiles();
        setTaggerFile(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save tags.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating file tags.');
    } finally {
      setSavingTags(false);
    }
  };

  // Validate token and fetch user details on mount/token change
  useEffect(() => {
    if (token) {
      const checkUser = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`);
          if (res.ok) {
            const data = await res.json();
            setCurrentUser(data);
          } else {
            setToken('');
            localStorage.removeItem('token');
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('Failed to verify token:', err);
        }
      };
      checkUser();
    } else {
      setCurrentUser(null);
    }
  }, [token]);

  // Fetch registered users list when Admin Dashboard is active
  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchG00JKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/g00j-keys`);
      if (res.ok) {
        const data = await res.json();
        setG00jKeysList(data);
      }
    } catch (err) {
      console.error('Failed to fetch g00j keys:', err);
    }
  };

  const handleCreateG00JKey = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/g00j-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newG00jKeyDesc })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminSuccess('Key generated: ' + data.key.key);
        setNewG00jKeyDesc('');
        fetchG00JKeys();
      } else {
        setAdminError(data.error || 'Failed to create key');
      }
    } catch (err) {
      setAdminError('Failed to connect to key service');
    }
  };

  const handleDeleteG00JKey = async (keyString) => {
    if (!confirm('Are you sure you want to revoke key ' + keyString + '?')) return;
    setAdminError('');
    setAdminSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/g00j-keys/${keyString}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        setAdminSuccess('Key revoked successfully');
        fetchG00JKeys();
      } else {
        setAdminError(data.error || 'Failed to revoke key');
      }
    } catch (err) {
      setAdminError('Failed to connect to key service');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupUsername,
          password: signupPassword,
          displayName: signupDisplayName,
          g00jKey: signupG00jKey,
          role: signupRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Signup successful! Please sign in.');
        setLoginMode('login');
        setSignupUsername('');
        setSignupDisplayName('');
        setSignupPassword('');
        setSignupG00jKey('');
      } else {
        setLoginError(data.error || 'Signup failed');
      }
    } catch (err) {
      setLoginError('Could not connect to authentication server');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResetPasswordWithG00jKey = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername,
          newPassword: resetPassword,
          g00jKey: resetG00jKey
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Password reset successful! Please sign in.');
        setLoginMode('login');
        setResetUsername('');
        setResetPassword('');
        setResetG00jKey('');
      } else {
        setLoginError(data.error || 'Password reset failed');
      }
    } catch (err) {
      setLoginError('Could not connect to authentication server');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleChangeVaultPassword = async (e) => {
    e.preventDefault();
    setVaultRotationError('');
    setVaultRotationSuccess('');
    if (newVaultPasswordInput !== confirmNewVaultPasswordInput) {
      setVaultRotationError('New passwords do not match');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/vault/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: vaultPassword,
          newPassword: newVaultPasswordInput
        })
      });
      const data = await res.json();
      if (res.ok) {
        setVaultRotationSuccess('Vault password changed and files re-encrypted!');
        setVaultPassword(newVaultPasswordInput);
        setNewVaultPasswordInput('');
        setConfirmNewVaultPasswordInput('');
        setTimeout(() => {
          setShowChangeVaultPasswordModal(false);
          setVaultRotationSuccess('');
        }, 2000);
      } else {
        setVaultRotationError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setVaultRotationError('Error communicating with vault rotation service');
    }
  };

  useEffect(() => {
    if (activeCategory === 'admin' && currentUser?.role === 'admin') {
      fetchUsers();
      fetchG00JKeys();
    }
  }, [activeCategory, currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Could not connect to authentication server');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      localStorage.removeItem('token');
      setToken('');
      setCurrentUser(null);
      setActiveCategory('all');
      setVaultPassword('');
      setIsVaultUnlocked(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole, displayName: newDisplayName })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminSuccess(`User "${newUsername}" created successfully!`);
        setNewUsername('');
        setNewPassword('');
        setNewRole('user');
        setNewDisplayName('');
        fetchUsers();
      } else {
        setAdminError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setAdminError('Failed to connect to server');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    if (!selectedUserIdForPasswordReset) {
      setAdminError('Please select a user');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUserIdForPasswordReset}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPasswordValue })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminSuccess('Password updated successfully!');
        setResetPasswordValue('');
        setSelectedUserIdForPasswordReset('');
      } else {
        setAdminError(data.error || 'Failed to update password');
      }
    } catch (err) {
      setAdminError('Failed to connect to server');
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (name === 'maoriboishido') {
      alert('Cannot delete the master admin account');
      return;
    }
    if (window.confirm(`Are you sure you want to delete user "${name}"?`)) {
      try {
        const res = await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setAdminSuccess(`User "${name}" deleted successfully!`);
          fetchUsers();
        } else {
          const data = await res.json();
          setAdminError(data.error || 'Failed to delete user');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const isSharedView = new URLSearchParams(window.location.search).has('shareFile') || 
                       new URLSearchParams(window.location.search).has('shareFolder');

  const handleLocalCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setTaggerTags(prev => ({ ...prev, coverArtUrl: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const openArchivesPicker = async () => {
    setShowArchivesPicker(true);
    setLoadingArchivesImages(true);
    try {
      const response = await fetch(`${API_BASE}/api/files?category=images`);
      if (response.ok) {
        const data = await response.json();
        setArchivesImages(data);
      }
    } catch (err) {
      console.error('Failed to load archives images:', err);
    } finally {
      setLoadingArchivesImages(false);
    }
  };

  const submitToMusicBrainz = () => {
    if (!taggerFile) return;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://musicbrainz.org/release/add';
    form.target = '_blank';
    form.enctype = 'multipart/form-data';

    const addField = (name, value) => {
      if (value !== undefined && value !== null && value !== '') {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
    };

    // Seed release details
    addField('name', taggerTags.album || taggerTags.title || 'Single');
    addField('artist_credit.names.0.name', taggerTags.artist || 'Unknown Artist');
    if (taggerTags.year) {
      addField('events.0.date.year', taggerTags.year);
    }
    addField('mediums.0.format', 'Digital Media');

    // Seed track details
    addField('mediums.0.track.0.name', taggerTags.title || taggerFile.originalName);
    addField('mediums.0.track.0.artist_credit.names.0.name', taggerTags.artist || 'Unknown Artist');

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };


  const fetchLyrics = async (trackName) => {
    setLoadingLyrics(true);
    setLyricsText('Searching for lyrics...');
    try {
      // Clean track name of extension
      const query = trackName.replace(/\.[^/.]+$/, "").trim();
      const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const match = data.find(item => item.plainLyrics) || data[0];
          if (match && match.plainLyrics) {
            setLyricsText(match.plainLyrics);
          } else if (match && match.instrumental) {
            setLyricsText('Instrumental Track (No lyrics)');
          } else {
            setLyricsText('Lyrics not found for this track.');
          }
        } else {
          setLyricsText('Lyrics not found on LRCLIB.');
        }
      } else {
        setLyricsText('Failed to retrieve lyrics from database.');
      }
    } catch (err) {
      console.error(err);
      setLyricsText('Could not connect to lyrics service.');
    } finally {
      setLoadingLyrics(false);
    }
  };

  useEffect(() => {
    if (activeAudioTrack) {
      fetchLyrics(activeAudioTrack.originalName);
    }
  }, [activeAudioTrack]);

  // Parse URL share parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sfId = params.get('shareFile');
    const sfFolderId = params.get('shareFolder');

    if (sfId) {
      setSharedFileId(sfId);
      setLoadingSharedFile(true);
      fetch(`${API_BASE}/api/files/${sfId}`)
        .then(res => {
          if (!res.ok) throw new Error('Shared file not found or inaccessible');
          return res.json();
        })
        .then(data => {
          setSharedFile(data);
          const textMimes = [
            'text/plain', 'text/html', 'text/css', 'text/csv',
            'application/javascript', 'application/json', 'application/x-javascript'
          ];
          if (data.mimeType.startsWith('text/') || textMimes.includes(data.mimeType)) {
            fetch(getFileDownloadUrl(data))
              .then(res => {
                if (!res.ok) throw new Error('Could not download content');
                return res.text();
              })
              .then(text => {
                setTextContent(text.slice(0, 10000));
              })
              .catch(err => setTextContent(`Failed to load text: ${err.message}`));
          }
        })
        .catch(err => {
          setSharedFileError(err.message);
        })
        .finally(() => {
          setLoadingSharedFile(false);
        });
    } else if (sfFolderId) {
      setSharedFolderRootId(sfFolderId);
      setCurrentFolderId(sfFolderId);
      fetch(`${API_BASE}/api/folders/${sfFolderId}`)
        .then(res => {
          if (!res.ok) throw new Error('Shared folder not found');
          return res.json();
        })
        .then(data => {
          setSharedFolderRoot(data);
        })
        .catch(err => console.error('Error fetching shared folder root:', err));
    }
  }, []);

  const getShareUrlBase = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'https://shido275.github.io/the-g00j-archive';
    }
    return window.location.origin + window.location.pathname.replace(/\/$/, '');
  };

  const openShareModal = (e, target, type = 'file') => {
    e.stopPropagation();
    setShareTarget(target);
    setShareTargetType(type);
    setCopied(false);
    setShowShareModal(true);
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === Infinity) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const playTrack = (track) => {
    // Build active audio files queue
    const audioTracks = files.filter(f => f.category === 'audio');
    setAudioQueue(audioTracks);
    setActiveAudioTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);

    if (audioRef.current) {
      audioRef.current.src = getFileDownloadUrl(track);
      audioRef.current.load();
      audioRef.current.play().catch(err => console.log('Autoplay blocked:', err));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.log(err));
      setIsPlaying(true);
    }
  };

  const playNext = () => {
    if (audioQueue.length <= 1) {
      if (isLooping && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    let nextIndex = 0;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * audioQueue.length);
      const curIdx = audioQueue.findIndex(t => t.id === activeAudioTrack.id);
      if (nextIndex === curIdx && audioQueue.length > 1) {
        nextIndex = (nextIndex + 1) % audioQueue.length;
      }
    } else {
      const curIdx = audioQueue.findIndex(t => t.id === activeAudioTrack.id);
      nextIndex = (curIdx + 1) % audioQueue.length;
    }

    const nextTrack = audioQueue[nextIndex];
    if (nextTrack) {
      setActiveAudioTrack(nextTrack);
      if (audioRef.current) {
        audioRef.current.src = getFileDownloadUrl(nextTrack);
        audioRef.current.load();
        audioRef.current.play().catch(err => console.log(err));
        setIsPlaying(true);
      }
    }
  };

  const playPrev = () => {
    if (audioQueue.length <= 1) return;
    const curIdx = audioQueue.findIndex(t => t.id === activeAudioTrack.id);
    let prevIndex = curIdx - 1;
    if (prevIndex < 0) prevIndex = audioQueue.length - 1;

    const prevTrack = audioQueue[prevIndex];
    if (prevTrack) {
      setActiveAudioTrack(prevTrack);
      if (audioRef.current) {
        audioRef.current.src = getFileDownloadUrl(prevTrack);
        audioRef.current.load();
        audioRef.current.play().catch(err => console.log(err));
        setIsPlaying(true);
      }
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const targetMuted = !isMuted;
    setIsMuted(targetMuted);
    audioRef.current.muted = targetMuted;
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Advanced scraper schedule states
  const [scraperJobs, setScraperJobs] = useState([]);
  const [scrapedFolderSelections, setScrapedFolderSelections] = useState({});
  const [scheduleOption, setScheduleOption] = useState('once');
  const [scheduleFolderId, setScheduleFolderId] = useState('root');

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);


  const isDescendantOfSharedRoot = (folderId) => {
    if (!sharedFolderRootId) return true;
    if (folderId === sharedFolderRootId) return true;
    let currentId = folderId;
    const visited = new Set();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      if (currentId === sharedFolderRootId) return true;
      const f = allFolders.find(x => x.id === currentId);
      currentId = f ? f.parentId : null;
    }
    return false;
  };

  // Fetch files on search or category change
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const url = new URL(API_BASE + '/api/files', window.location.origin);
      if (activeCategory === 'vault') {
        url.searchParams.append('vault', 'true');
      } else if (activeCategory !== 'all') {
        url.searchParams.append('category', activeCategory);
      }
      
      if (activeCategory === 'all' || activeCategory === 'vault') {
        if (!searchQuery) {
          url.searchParams.append('folderId', currentFolderId || 'root');
        }
      }
      if (searchQuery) {
        url.searchParams.append('search', searchQuery);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        let data = await response.json();
        if (sharedFolderRootId) {
          data = data.filter(f => isDescendantOfSharedRoot(f.folderId));
        }
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
      const url = new URL(API_BASE + '/api/folders', window.location.origin);
      if (activeCategory === 'vault') {
        url.searchParams.append('vault', 'true');
      }
      if (currentFolderId) {
        url.searchParams.append('parentId', currentFolderId);
      } else {
        url.searchParams.append('parentId', 'root');
      }
      const response = await fetch(url.toString());
      if (response.ok) {
        let data = await response.json();
        if (sharedFolderRootId) {
          data = data.filter(f => isDescendantOfSharedRoot(f.parentId));
        }
        setFolders(data);
      }

      // Fetch all folders to compute breadcrumbs trail
      const allUrl = new URL(API_BASE + '/api/folders', window.location.origin);
      allUrl.searchParams.append('all', 'true');
      if (activeCategory === 'vault') {
        allUrl.searchParams.append('vault', 'true');
      }
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
    if ((activeCategory === 'all' || activeCategory === 'vault') && !searchQuery) {
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
      fetch(getFileDownloadUrl(previewFile))
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
        token: token,
        folderId: currentFolderId,
        vault: activeCategory === 'vault',
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

  useEffect(() => {
    setCurrentFolderId(null);
  }, [activeCategory]);

  useEffect(() => {
    if (activeCategory === 'vault' && token) {
      const checkVaultInit = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/vault/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'test-check-init' })
          });
          const data = await res.json();
          if (data.initialized === false) {
            setIsVaultInitialized(false);
          } else {
            setIsVaultInitialized(true);
          }
        } catch (e) {}
      };
      checkVaultInit();
    }
  }, [activeCategory, token]);

  const handleVaultUnlock = async (e) => {
    if (e) e.preventDefault();
    if (!vaultUnlockInput) return;
    setVaultError('');
    try {
      const res = await fetch(`${API_BASE}/api/vault/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: vaultUnlockInput })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.initialized === false) {
          setIsVaultInitialized(false);
        } else {
          setVaultPassword(vaultUnlockInput);
          setIsVaultUnlocked(true);
          setVaultUnlockInput('');
        }
      } else {
        setVaultError(data.error || 'Failed to unlock vault');
      }
    } catch (err) {
      setVaultError('Failed to connect to vault service');
    }
  };

  const handleVaultInitialize = async (e) => {
    if (e) e.preventDefault();
    if (!vaultUnlockInput || !vaultConfirmInput) {
      setVaultError('Please fill in all fields');
      return;
    }
    if (vaultUnlockInput !== vaultConfirmInput) {
      setVaultError('Passwords do not match');
      return;
    }
    setVaultError('');
    try {
      const res = await fetch(`${API_BASE}/api/vault/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: vaultUnlockInput })
      });
      const data = await res.json();
      if (res.ok) {
        setVaultPassword(vaultUnlockInput);
        setIsVaultUnlocked(true);
        setIsVaultInitialized(true);
        setVaultUnlockInput('');
        setVaultConfirmInput('');
        setVaultSuccess('Vault successfully initialized!');
        setTimeout(() => setVaultSuccess(''), 3000);
      } else {
        setVaultError(data.error || 'Failed to initialize vault');
      }
    } catch (err) {
      setVaultError('Failed to connect to vault service');
    }
  };

  const handleVaultLock = () => {
    setVaultPassword('');
    setIsVaultUnlocked(false);
    setVaultUnlockInput('');
    setVaultConfirmInput('');
    setVaultError('');
  };

  const handleCreateFolder = async () => {
    const folderName = window.prompt('Enter folder name:');
    if (!folderName || !folderName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName.trim(),
          parentId: currentFolderId || 'root',
          vault: activeCategory === 'vault'
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
        const response = await fetch(`${API_BASE}/api/folders/${id}`, {
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
        if (currentId === sharedFolderRootId) {
          break; // Stop climbing up beyond the shared folder root
        }
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
      const response = await fetch(`${API_BASE}/api/scrape`, {
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
      const response = await fetch(`${API_BASE}/api/scrape/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: link.url,
          folderId: targetFolderId === 'root' ? null : targetFolderId,
          vault: activeCategory === 'vault'
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
      const response = await fetch(`${API_BASE}/api/scraper/jobs`);
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
      const response = await fetch(`${API_BASE}/api/scraper/jobs`, {
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
        const response = await fetch(`${API_BASE}/api/scraper/jobs/${jobId}`, {
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
        const response = await fetch(`${API_BASE}/api/files/${id}`, { method: 'DELETE' });
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
    link.href = getFileDownloadUrl(file, true);
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

  if (sharedFileId) {
    if (loadingSharedFile) {
      return (
        <div className="shared-layout">
          <div className="ambient-glow-1"></div>
          <div className="ambient-glow-2"></div>
          <div className="shared-card glass-panel" style={{ justifyContent: 'center', minHeight: '300px' }}>
            <RefreshCw className="spin" style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent-indigo)', marginBottom: '16px' }} size={40} />
            <p style={{ color: 'var(--text-secondary)' }}>Retrieving shared file details...</p>
          </div>
        </div>
      );
    }

    if (sharedFileError) {
      return (
        <div className="shared-layout">
          <div className="ambient-glow-1"></div>
          <div className="ambient-glow-2"></div>
          <div className="shared-card glass-panel" style={{ justifyContent: 'center', minHeight: '300px' }}>
            <AlertCircle size={48} style={{ color: 'var(--accent-rose)', marginBottom: '16px' }} />
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: '#fff' }}>Access Error</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{sharedFileError}</p>
            <button className="glow-btn" onClick={() => window.location.href = '/'} style={{ padding: '10px 24px', borderRadius: '8px' }}>
              Go to Homepage
            </button>
          </div>
        </div>
      );
    }

    if (sharedFile) {
      return (
        <div className="shared-layout">
          <div className="ambient-glow-1"></div>
          <div className="ambient-glow-2"></div>

          <div className="shared-card glass-panel">
            <div className="shared-logo">
              <div className="logo-icon" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gradient-accent)', borderRadius: '8px' }}>
                <HardDrive size={18} color="#fff" />
              </div>
              <span className="logo-text" style={{ fontSize: '1.1rem' }}>G00J ARCHIVES</span>
            </div>

            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '20px', color: '#fff', wordBreak: 'break-all' }}>
              {sharedFile.artist && sharedFile.title ? `${sharedFile.artist} - ${sharedFile.title}` : sharedFile.originalName}
            </h2>

            {/* Inline Preview box based on file type */}
            <div className="shared-preview-box">
              {sharedFile.category === 'images' && (
                <img
                  src={getFileDownloadUrl(sharedFile)}
                  alt={sharedFile.originalName}
                />
              )}

              {sharedFile.category === 'videos' && (
                <video
                  src={getFileDownloadUrl(sharedFile)}
                  controls
                  autoPlay
                />
              )}

              {sharedFile.category === 'audio' && (
                <div className="preview-audio-container" style={{ width: '100%' }}>
                  <div className="audio-disk playing" style={{ margin: '0 auto 16px auto', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                    <Music size={32} />
                  </div>
                  <audio
                    src={getFileDownloadUrl(sharedFile)}
                    controls
                    autoPlay
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Text document & code */}
              {(sharedFile.mimeType.startsWith('text/') ||
                sharedFile.mimeType === 'application/json' ||
                sharedFile.mimeType === 'application/javascript') && (
                  <pre>
                    {textContent}
                  </pre>
                )}

              {/* Fallback for files that cannot be viewed inline */}
              {sharedFile.category !== 'images' &&
                sharedFile.category !== 'videos' &&
                sharedFile.category !== 'audio' &&
                !sharedFile.mimeType.startsWith('text/') &&
                sharedFile.mimeType !== 'application/json' &&
                sharedFile.mimeType !== 'application/javascript' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px' }}>
                    <div className="list-icon-box" style={{ width: '64px', height: '64px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {getCategoryIcon(sharedFile.category, 32)}
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Preview not supported for this file type</span>
                  </div>
                )}
            </div>

            {/* Metadata attributes */}
            <div className="shared-details">
              <div className="shared-detail-row">
                <span className="shared-detail-label">File Type</span>
                <span className="shared-detail-value" style={{ textTransform: 'capitalize' }}>{sharedFile.category} ({sharedFile.mimeType.split('/')[1] || sharedFile.mimeType})</span>
              </div>
              <div className="shared-detail-row">
                <span className="shared-detail-label">Size</span>
                <span className="shared-detail-value">{formatBytes(sharedFile.size)}</span>
              </div>
              <div className="shared-detail-row">
                <span className="shared-detail-label">Upload Date</span>
                <span className="shared-detail-value">{new Date(sharedFile.uploadDate).toLocaleString()}</span>
              </div>
              {sharedFile.artist && (
                <div className="shared-detail-row">
                  <span className="shared-detail-label">Artist</span>
                  <span className="shared-detail-value">{sharedFile.artist}</span>
                </div>
              )}
              {sharedFile.title && (
                <div className="shared-detail-row">
                  <span className="shared-detail-label">Track Title</span>
                  <span className="shared-detail-value">{sharedFile.title}</span>
                </div>
              )}
              {sharedFile.album && (
                <div className="shared-detail-row">
                  <span className="shared-detail-label">Album</span>
                  <span className="shared-detail-value">{sharedFile.album}</span>
                </div>
              )}
            </div>

            {/* Download button */}
            <button
              className="glow-btn shared-download-btn"
              onClick={(e) => handleDownload(e, sharedFile)}
            >
              <Download size={18} />
              Download File
            </button>

            <button
              className="modal-btn"
              style={{ width: '100%', border: '1px solid var(--glass-border)', background: 'transparent' }}
              onClick={() => window.location.href = '/'}
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }
  }

  if (!token && !isSharedView) {
    return (
      <div className="login-container">
        <div className="ambient-glow-1"></div>
        <div className="ambient-glow-2"></div>
        <div className="login-card glass-panel">
          <div className="login-header">
            <HardDrive className="login-logo animate-pulse" size={48} />
            <h1 className="login-title">G00J Archives</h1>
            <p className="login-subtitle">Premium Cloud Storage & Music Studio</p>
          </div>

          {loginMode === 'login' && (
            <form className="login-form" onSubmit={handleLogin}>
              {loginError && (
                <div className="login-error-alert">
                  <AlertCircle size={16} />
                  <span>{loginError}</span>
                </div>
              )}
              <div className="login-input-group">
                <label className="login-input-label">Username</label>
                <input
                  type="text"
                  className="login-input search-input"
                  placeholder="Enter username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                />
              </div>
              <div className="login-input-group">
                <label className="login-input-label">Password</label>
                <input
                  type="password"
                  className="login-input search-input"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="login-submit-btn glow-btn" disabled={loginLoading}>
                {loginLoading ? 'Signing In...' : 'Sign In'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.8rem' }}>
                <span onClick={() => { setLoginMode('signup'); setLoginError(''); }} style={{ color: 'var(--accent-indigo)', cursor: 'pointer', fontWeight: 500 }}>Create Account</span>
                <span onClick={() => { setLoginMode('reset'); setLoginError(''); }} style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>Forgot Password?</span>
              </div>
            </form>
          )}

          {loginMode === 'signup' && (
            <form className="login-form" onSubmit={handleSignup}>
              {loginError && (
                <div className="login-error-alert">
                  <AlertCircle size={16} />
                  <span>{loginError}</span>
                </div>
              )}
              <div className="login-input-group">
                <label className="login-input-label">Username</label>
                <input
                  type="text"
                  className="login-input search-input"
                  placeholder="Enter username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  required
                />
              </div>
              <div className="login-input-group">
                <label className="login-input-label">Display Name</label>
                <input
                  type="text"
                  className="login-input search-input"
                  placeholder="Enter display name"
                  value={signupDisplayName}
                  onChange={(e) => setSignupDisplayName(e.target.value)}
                />
              </div>
              <div className="login-input-group">
                <label className="login-input-label">Password</label>
                <input
                  type="password"
                  className="login-input search-input"
                  placeholder="Enter password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
              </div>
              <div className="login-input-group">
                <label className="login-input-label">Role</label>
                <select
                  className="editor-select"
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  style={{ width: '100%', height: '38px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
                >
                  <option value="user">Regular User</option>
                  <option value="premium">Premium User</option>
                </select>
              </div>
              <div className="login-input-group">
                <label className="login-input-label">Invite / g00j Key</label>
                <input
                  type="text"
                  className="login-input search-input"
                  placeholder="Enter invite key (e.g. G00J-...)"
                  value={signupG00jKey}
                  onChange={(e) => setSignupG00jKey(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="login-submit-btn glow-btn" disabled={loginLoading}>
                {loginLoading ? 'Registering...' : 'Register'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem' }}>
                <span onClick={() => { setLoginMode('login'); setLoginError(''); }} style={{ color: 'var(--accent-indigo)', cursor: 'pointer', fontWeight: 500 }}>Back to Sign In</span>
              </div>
            </form>
          )}

          {loginMode === 'reset' && (
            <form className="login-form" onSubmit={handleResetPasswordWithG00jKey}>
              {loginError && (
                <div className="login-error-alert">
                  <AlertCircle size={16} />
                  <span>{loginError}</span>
                </div>
              )}
              <div className="login-input-group">
                <label className="login-input-label">Username</label>
                <input
                  type="text"
                  className="login-input search-input"
                  placeholder="Enter username"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  required
                />
              </div>
              <div className="login-input-group">
                <label className="login-input-label">New Password</label>
                <input
                  type="password"
                  className="login-input search-input"
                  placeholder="Enter new password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </div>
              <div className="login-input-group">
                <label className="login-input-label">g00j Key</label>
                <input
                  type="text"
                  className="login-input search-input"
                  placeholder="Enter reset key (e.g. G00J-...)"
                  value={resetG00jKey}
                  onChange={(e) => setResetG00jKey(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="login-submit-btn glow-btn" disabled={loginLoading}>
                {loginLoading ? 'Resetting...' : 'Reset Password'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem' }}>
                <span onClick={() => { setLoginMode('login'); setLoginError(''); }} style={{ color: 'var(--accent-indigo)', cursor: 'pointer', fontWeight: 500 }}>Back to Sign In</span>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

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
      {!sharedFolderRootId && (
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
            <a
              className={`nav-item ${activeCategory === 'vault' ? 'active' : ''}`}
              onClick={() => setActiveCategory('vault')}
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', marginTop: '8px', paddingTop: '12px' }}
            >
              <Lock size={18} style={{ color: isVaultUnlocked ? 'var(--accent-indigo)' : 'inherit' }} />
              <span>Secure Vault</span>
            </a>
            {currentUser?.role === 'admin' && (
              <a
                className={`nav-item ${activeCategory === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveCategory('admin')}
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', marginTop: '8px', paddingTop: '12px' }}
              >
                <Sliders size={18} />
                <span>Admin Dashboard</span>
              </a>
            )}
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

          <div className="user-profile-sidebar" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px 8px 0 8px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="avatar-placeholder" style={{ background: 'var(--accent-indigo)', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                {(currentUser?.displayName || currentUser?.username)?.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.displayName || currentUser?.username}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {currentUser?.role === 'admin' ? 'Administrator' : currentUser?.role === 'premium' ? 'Premium User' : 'User'}
                </span>
              </div>
            </div>
            <button className="glow-btn" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: '0.75rem', width: '100%', margin: 0, height: '32px' }}>
              Log Out
            </button>
          </div>
        </aside>
      )}

      {/* Main Panel */}
      <main className={`main-content ${activeAudioTrack ? 'ytm-player-bar-offset' : ''}`}>
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

            {!sharedFolderRootId && (
              <>
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
              </>
            )}
          </div>
        </header>

        {/* Content body */}
        <section className="content-body">
          {activeCategory === 'vault' && !isVaultUnlocked ? (
            <div className="vault-container glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', minHeight: '400px' }}>
              <div className="category-banner" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="category-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={24} style={{ color: 'var(--accent-indigo)' }} />
                    Secure Restricted Vault
                  </h2>
                  <p className="category-subtitle">Zero-knowledge AES-256 encrypted file storage</p>
                </div>
              </div>
              <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                {vaultError && (
                  <div className="admin-alert-box error" style={{ marginBottom: '16px' }}>
                    <AlertCircle size={14} />
                    <span>{vaultError}</span>
                  </div>
                )}
                {vaultSuccess && (
                  <div className="admin-alert-box success" style={{ marginBottom: '16px' }}>
                    <span>{vaultSuccess}</span>
                  </div>
                )}
                {isVaultInitialized ? (
                  <form onSubmit={handleVaultUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="login-input-group">
                      <label className="login-input-label">Enter Vault Password</label>
                      <input
                        type="password"
                        className="login-input search-input"
                        placeholder="Password"
                        value={vaultUnlockInput}
                        onChange={(e) => setVaultUnlockInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="login-submit-btn glow-btn">
                      Unlock Vault
                    </button>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '8px', lineHeight: '1.4' }}>
                      If you have never set a vault password, enter your desired password. It will initialize the vault for you.
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleVaultInitialize} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Setup Secure Vault</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      Choose a strong vault password. This password will derive keys to encrypt files locally before sync. 
                      <strong> If lost, your vault files cannot be recovered.</strong>
                    </p>
                    <div className="login-input-group">
                      <label className="login-input-label">Vault Password</label>
                      <input
                        type="password"
                        className="login-input search-input"
                        placeholder="Enter password"
                        value={vaultUnlockInput}
                        onChange={(e) => setVaultUnlockInput(e.target.value)}
                      />
                    </div>
                    <div className="login-input-group">
                      <label className="login-input-label">Confirm Password</label>
                      <input
                        type="password"
                        className="login-input search-input"
                        placeholder="Confirm password"
                        value={vaultConfirmInput}
                        onChange={(e) => setVaultConfirmInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="login-submit-btn glow-btn">
                      Initialize Vault
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : activeCategory === 'admin' ? (
            <div className="admin-dashboard-container glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', minHeight: '400px' }}>
              <div className="category-banner" style={{ marginBottom: '24px', paddingBottom: '0' }}>
                <div>
                  <h2 className="category-title">Admin Dashboard</h2>
                  <p className="category-subtitle">Manage system users, roles, and security policies</p>
                </div>
              </div>

              <div className="admin-tabs-nav">
                <button
                  className={`admin-tab-btn ${adminViewTab === 'users' ? 'active' : ''}`}
                  onClick={() => { setAdminViewTab('users'); setAdminError(''); setAdminSuccess(''); }}
                >
                  User List
                </button>
                <button
                  className={`admin-tab-btn ${adminViewTab === 'create' ? 'active' : ''}`}
                  onClick={() => { setAdminViewTab('create'); setAdminError(''); setAdminSuccess(''); }}
                >
                  Create User
                </button>
                <button
                  className={`admin-tab-btn ${adminViewTab === 'password' ? 'active' : ''}`}
                  onClick={() => { setAdminViewTab('password'); setAdminError(''); setAdminSuccess(''); }}
                >
                  Reset Password
                </button>
                <button
                  className={`admin-tab-btn ${adminViewTab === 'g00j-keys' ? 'active' : ''}`}
                  onClick={() => { setAdminViewTab('g00j-keys'); setAdminError(''); setAdminSuccess(''); }}
                >
                  Invite Keys (g00j)
                </button>
              </div>

              {adminError && (
                <div className="admin-alert-box error" style={{ marginBottom: '16px' }}>
                  <AlertCircle size={14} />
                  <span>{adminError}</span>
                </div>
              )}
              {adminSuccess && (
                <div className="admin-alert-box success" style={{ marginBottom: '16px' }}>
                  <AlertCircle size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>{adminSuccess}</span>
                </div>
              )}

              {adminViewTab === 'users' && (
                <div className="files-list-wrapper glass-panel" style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}>
                  <table className="files-list-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Display Name</th>
                        <th>Role</th>
                        <th>Created Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map(u => (
                        <tr key={u.id} className="files-list-row" style={{ cursor: 'default' }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ background: u.role === 'admin' ? 'rgba(99, 102, 241, 0.15)' : u.role === 'premium' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: u.role === 'admin' ? 'var(--accent-indigo)' : u.role === 'premium' ? '#ec4899' : 'var(--text-secondary)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                {(u.displayName || u.username).charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600 }}>{u.username}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-primary)' }}>{u.displayName || u.username}</span>
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: u.role === 'admin' ? 'rgba(99, 102, 241, 0.15)' : u.role === 'premium' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              color: u.role === 'admin' ? 'var(--accent-indigo)' : u.role === 'premium' ? '#ec4899' : 'var(--text-secondary)'
                            }}>
                              {u.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="list-date-cell">{new Date(u.createdDate).toLocaleDateString()}</td>
                          <td>
                            <div className="list-actions-cell" style={{ justifyContent: 'flex-end' }}>
                              {u.username !== 'maoriboishido' ? (
                                <>
                                  <button
                                    className="file-action-btn"
                                    onClick={() => {
                                      setSelectedUserIdForPasswordReset(u.id);
                                      setAdminViewTab('password');
                                    }}
                                    title="Reset Password"
                                    style={{ color: 'var(--accent-indigo)', marginRight: '8px' }}
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    className="file-action-btn btn-delete"
                                    onClick={() => handleDeleteUser(u.id, u.username)}
                                    title="Delete User"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>System Admin</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {adminViewTab === 'create' && (
                <div className="admin-form-card glass-panel" style={{ maxWidth: '440px' }}>
                  <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="login-input-group">
                      <label className="login-input-label">Username</label>
                      <input
                        type="text"
                        className="search-input"
                        style={{ height: '38px', paddingLeft: '12px' }}
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Enter username"
                        required
                      />
                    </div>
                    <div className="login-input-group">
                      <label className="login-input-label">Display Name (Optional)</label>
                      <input
                        type="text"
                        className="search-input"
                        style={{ height: '38px', paddingLeft: '12px' }}
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="Enter display name"
                      />
                    </div>
                    <div className="login-input-group">
                      <label className="login-input-label">Password</label>
                      <input
                        type="password"
                        className="search-input"
                        style={{ height: '38px', paddingLeft: '12px' }}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter initial password"
                        required
                      />
                    </div>
                    <div className="login-input-group">
                      <label className="login-input-label">Role</label>
                      <select
                        className="editor-select"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        style={{ height: '38px', border: '1px solid var(--glass-border)' }}
                      >
                        <option value="user">Regular User</option>
                        <option value="premium">Premium User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    <button type="submit" className="glow-btn" style={{ width: '100%', height: '38px', margin: '8px 0 0 0' }}>
                      Create User Account
                    </button>
                  </form>
                </div>
              )}

              {adminViewTab === 'password' && (
                <div className="admin-form-card glass-panel" style={{ maxWidth: '440px' }}>
                  <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="login-input-group">
                      <label className="login-input-label">Select User</label>
                      <select
                        className="editor-select"
                        value={selectedUserIdForPasswordReset}
                        onChange={(e) => setSelectedUserIdForPasswordReset(e.target.value)}
                        style={{ height: '38px', border: '1px solid var(--glass-border)' }}
                        required
                      >
                        <option value="">-- Choose User --</option>
                        {usersList.filter(u => u.username !== 'maoriboishido').map(u => (
                          <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                      </select>
                    </div>
                    <div className="login-input-group">
                      <label className="login-input-label">New Password</label>
                      <input
                        type="password"
                        className="search-input"
                        style={{ height: '38px', paddingLeft: '12px' }}
                        value={resetPasswordValue}
                        onChange={(e) => setResetPasswordValue(e.target.value)}
                        placeholder="Enter new password"
                        required
                      />
                    </div>
                    <button type="submit" className="glow-btn" style={{ width: '100%', height: '38px', margin: '8px 0 0 0' }}>
                      Update Password
                    </button>
                  </form>
                </div>
              )}

              {adminViewTab === 'g00j-keys' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="admin-form-card glass-panel" style={{ maxWidth: '440px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Generate Invite Key</h3>
                    <form onSubmit={handleCreateG00JKey} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="login-input-group">
                        <label className="login-input-label">Key Description</label>
                        <input
                          type="text"
                          className="search-input"
                          style={{ height: '38px', paddingLeft: '12px' }}
                          value={newG00jKeyDesc}
                          onChange={(e) => setNewG00jKeyDesc(e.target.value)}
                          placeholder="e.g. Invite for RoutrMann premium signup"
                          required
                        />
                      </div>
                      <button type="submit" className="glow-btn" style={{ width: '100%', height: '38px', margin: '8px 0 0 0' }}>
                        Generate g00j Key
                      </button>
                    </form>
                  </div>

                  <div className="files-list-wrapper glass-panel" style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Active Invite Keys</h3>
                    {g00jKeysList.length === 0 ? (
                      <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '0.9rem' }}>No generated keys. You can also use "G00J-MASTER-KEY" permanently.</p>
                    ) : (
                      <table className="files-list-table">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Description</th>
                            <th>Created Date</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g00jKeysList.map(k => (
                            <tr key={k.key} className="files-list-row" style={{ cursor: 'default' }}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <code style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent-indigo)', fontWeight: 'bold' }}>{k.key}</code>
                                  <button
                                    className="file-action-btn"
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(k.key);
                                      alert('Copied to clipboard!');
                                    }}
                                    title="Copy Key"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </td>
                              <td style={{ color: 'var(--text-secondary)' }}>{k.description}</td>
                              <td className="list-date-cell">{new Date(k.createdDate).toLocaleDateString()}</td>
                              <td>
                                <div className="list-actions-cell" style={{ justifyContent: 'flex-end' }}>
                                  <button
                                    className="file-action-btn btn-delete"
                                    onClick={() => handleDeleteG00JKey(k.key)}
                                    title="Revoke Key"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="category-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="category-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                    {activeCategory === 'vault' ? (
                      <>
                        <Unlock size={20} style={{ color: 'var(--accent-indigo)' }} />
                        Secure Vault
                      </>
                    ) : `${activeCategory} Files`}
                  </h2>
                  <p className="category-subtitle">
                    {(files.length + folders.length)} {(files.length + folders.length) === 1 ? 'item' : 'items'} stored in this category
                  </p>
                </div>
                {activeCategory === 'vault' && isVaultUnlocked && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="glow-btn" onClick={() => setShowChangeVaultPasswordModal(true)} style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: 'var(--accent-indigo)', height: '36px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <Key size={14} />
                      Change Vault Key
                    </button>
                    <button className="glow-btn" onClick={handleVaultLock} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', height: '36px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <Lock size={14} />
                      Lock Vault
                    </button>
                  </div>
                )}
              </div>

              {/* Breadcrumbs Navigation */}
              {(activeCategory === 'all' || activeCategory === 'vault') && !searchQuery && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {!sharedFolderRootId ? (
                    <span
                      onClick={() => setCurrentFolderId(null)}
                      style={{ cursor: 'pointer', color: currentFolderId ? 'var(--accent-indigo)' : 'inherit', fontWeight: currentFolderId ? 500 : 600 }}
                    >
                      Root
                    </span>
              ) : (
                <span
                  onClick={() => setCurrentFolderId(sharedFolderRootId)}
                  style={{ cursor: 'pointer', color: currentFolderId !== sharedFolderRootId ? 'var(--accent-indigo)' : 'inherit', fontWeight: currentFolderId !== sharedFolderRootId ? 500 : 600 }}
                >
                  {sharedFolderRoot?.name || 'Shared Root'}
                </span>
              )}
              {(() => {
                const visibleCrumbs = getBreadcrumbs().filter(crumb => !sharedFolderRootId || crumb.id !== sharedFolderRootId);
                return visibleCrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                    <span
                      onClick={() => setCurrentFolderId(crumb.id)}
                      style={{
                        cursor: 'pointer',
                        color: idx === visibleCrumbs.length - 1 ? 'inherit' : 'var(--accent-indigo)',
                        fontWeight: idx === visibleCrumbs.length - 1 ? 600 : 500
                      }}
                    >
                      {crumb.name}
                    </span>
                  </React.Fragment>
                ));
              })()}
            </div>
          )}

          {/* Drag drop zone helper */}
          {!sharedFolderRootId && (
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
          )}

          {loading && files.length === 0 && folders.length === 0 ? (
            <div className="empty-state">
              <RefreshCw className="empty-icon spin" style={{ animation: 'spin 1.5s linear infinite' }} size={40} />
              <p>Fetching files from the Archives...</p>
            </div>
          ) : files.length === 0 && folders.length === 0 ? (
            <div className="empty-state">
              <FolderOpen className="empty-icon" size={48} />
              <p className="drag-text-main">No files or folders found</p>
              <p className="drag-text-sub">
                {!sharedFolderRootId
                  ? "Select files or drag them above to start uploading to your storage!"
                  : "This shared folder is empty."
                }
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            // Grid Layout
            <div className="files-grid">
              {/* Folder list */}
              {(activeCategory === 'all' || activeCategory === 'vault') && !searchQuery && folders.map(folder => (
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
                    {!sharedFolderRootId ? (
                      <>
                        {!folder.isVault && (
                          <button
                            className="file-action-btn"
                            onClick={(e) => openShareModal(e, folder, 'folder')}
                            title="Share Folder"
                            style={{ color: 'var(--accent-indigo)', marginRight: '8px' }}
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                        <button
                          className="file-action-btn btn-delete"
                          onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                          title="Delete Folder"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Read Only</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Files list */}
              {files.map(file => (
                <div
                  key={file.id}
                  className="file-card glass-card"
                  onClick={() => file.category === 'audio' ? playTrack(file) : setPreviewFile(file)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="file-card-preview">
                    {file.category === 'images' ? (
                      <img
                        src={getFileDownloadUrl(file)}
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
                    <span className="file-name" title={file.originalName}>
                      {file.title && file.artist ? `${file.artist} - ${file.title}` : file.originalName}
                      {activeAudioTrack?.id === file.id && (
                        <div className={`ytm-equalizer ${isPlaying ? '' : 'paused'}`}>
                          <div className="ytm-equalizer-bar"></div>
                          <div className="ytm-equalizer-bar"></div>
                          <div className="ytm-equalizer-bar"></div>
                        </div>
                      )}
                    </span>
                    <div className="file-meta">
                      <span>{formatBytes(file.size)}</span>
                      <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="file-card-actions">
                    <button
                      className="file-action-btn"
                      onClick={(e) => { e.stopPropagation(); file.category === 'audio' ? playTrack(file) : setPreviewFile(file); }}
                      title="Preview File"
                    >
                      <Eye size={14} />
                    </button>
                    {file.category === 'audio' && !sharedFolderRootId && (
                      <>
                        <button
                          className="file-action-btn"
                          onClick={(e) => { e.stopPropagation(); openTagger(file); }}
                          title="Edit Tags / Tagger"
                          style={{ color: 'var(--accent-indigo)' }}
                        >
                          <Tag size={14} />
                        </button>
                        <button
                          className="file-action-btn"
                          onClick={(e) => { e.stopPropagation(); openDistribute(file); }}
                          title="Release / Distribute Music"
                          style={{ color: 'var(--accent-indigo)' }}
                        >
                          <Radio size={14} />
                        </button>
                      </>
                    )}
                    <button
                      className="file-action-btn"
                      onClick={(e) => handleDownload(e, file)}
                      title="Download File"
                    >
                      <Download size={14} />
                    </button>
                    {!sharedFolderRootId && (
                      <>
                        {!file.isVault && (
                          <button
                            className="file-action-btn"
                            onClick={(e) => openShareModal(e, file)}
                            title="Share File"
                            style={{ color: 'var(--accent-indigo)' }}
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                        <button
                          className="file-action-btn btn-delete"
                          onClick={(e) => handleDelete(e, file.id)}
                          title="Delete File"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
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
                  {(activeCategory === 'all' || activeCategory === 'vault') && !searchQuery && folders.map(folder => (
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
                          {!sharedFolderRootId ? (
                            <>
                              {!folder.isVault && (
                                <button
                                  className="file-action-btn"
                                  onClick={(e) => openShareModal(e, folder, 'folder')}
                                  title="Share Folder"
                                  style={{ color: 'var(--accent-indigo)', marginRight: '8px' }}
                                >
                                  <Share2 size={14} />
                                </button>
                              )}
                              <button
                                className="file-action-btn btn-delete"
                                onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
                                title="Delete Folder"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Read Only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Files row list */}
                  {files.map(file => (
                    <tr
                      key={file.id}
                      className="files-list-row"
                      onClick={() => file.category === 'audio' ? playTrack(file) : setPreviewFile(file)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="list-file-name-cell">
                          <div className={`list-icon-box cat-${file.category}`}>
                            {getCategoryIcon(file.category, 18)}
                          </div>
                          <span className="list-file-name-text" title={file.originalName}>
                            {file.title && file.artist ? `${file.artist} - ${file.title}` : file.originalName}
                            {activeAudioTrack?.id === file.id && (
                              <div className={`ytm-equalizer ${isPlaying ? '' : 'paused'}`}>
                                <div className="ytm-equalizer-bar"></div>
                                <div className="ytm-equalizer-bar"></div>
                                <div className="ytm-equalizer-bar"></div>
                              </div>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="list-size-cell">{formatBytes(file.size)}</td>
                      <td className="list-date-cell">{new Date(file.uploadDate).toLocaleDateString()}</td>
                      <td>
                        <div className="list-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="file-action-btn"
                            onClick={() => file.category === 'audio' ? playTrack(file) : setPreviewFile(file)}
                            title="Preview File"
                          >
                            <Eye size={14} />
                          </button>
                          {file.category === 'audio' && !sharedFolderRootId && (
                            <>
                              <button
                                className="file-action-btn"
                                onClick={() => openTagger(file)}
                                title="Edit Tags / Tagger"
                                style={{ color: 'var(--accent-indigo)' }}
                              >
                                <Tag size={14} />
                              </button>
                              <button
                                className="file-action-btn"
                                onClick={() => openDistribute(file)}
                                title="Release / Distribute Music"
                                style={{ color: 'var(--accent-indigo)' }}
                              >
                                <Radio size={14} />
                              </button>
                            </>
                          )}
                          <button
                            className="file-action-btn"
                            onClick={(e) => handleDownload(e, file)}
                            title="Download File"
                          >
                            <Download size={14} />
                          </button>
                          {!sharedFolderRootId && (
                            <>
                              {!file.isVault && (
                                <button
                                  className="file-action-btn"
                                  onClick={(e) => openShareModal(e, file)}
                                  title="Share File"
                                  style={{ color: 'var(--accent-indigo)' }}
                                >
                                  <Share2 size={14} />
                                </button>
                              )}
                              <button
                                className="file-action-btn btn-delete"
                                onClick={(e) => handleDelete(e, file.id)}
                                title="Delete File"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </>
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
                    src={getFileDownloadUrl(previewFile)}
                    alt={previewFile.originalName}
                    className="preview-image"
                  />
                )}

                {previewFile.category === 'videos' && (
                  <video
                    src={getFileDownloadUrl(previewFile)}
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
                      src={getFileDownloadUrl(previewFile)}
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
                {previewFile.category === 'images' && !sharedFolderRootId && (
                  <button
                    className="modal-btn btn-action"
                    onClick={() => {
                      setEditorFile(previewFile);
                      setShowImageEditor(true);
                      setPreviewFile(null);
                    }}
                    style={{ background: 'var(--gradient-accent)', border: 'none' }}
                  >
                    <Edit3 size={14} />
                    Edit Image
                  </button>
                )}
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

        {/* Audio Tagger Modal */}
        {taggerFile && (
          <div className="modal-overlay" onClick={() => setTaggerFile(null)}>
            <div
              className="modal-container glass-panel"
              style={{ maxWidth: '900px', width: '90%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="modal-header">
                <span className="modal-title-text">Audio Tagger & MusicBrainz Matcher</span>
                <button className="modal-close-btn" onClick={() => setTaggerFile(null)}>
                  <X size={18} />
                </button>
              </header>

              {loadingTaggerData ? (
                <div className="empty-state" style={{ padding: '60px' }}>
                  <RefreshCw className="empty-icon spin" style={{ animation: 'spin 1.5s linear infinite' }} size={36} />
                  <p>Reading audio metadata from file...</p>
                </div>
              ) : (
                <div className="ytm-tagger-layout">
                  {/* Left Panel: Current & Form Tags */}
                  <div className="ytm-tagger-column">
                    <h3 className="ytm-tagger-section-title">Edit Metadata</h3>

                    <div className="ytm-tagger-form">
                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Title</label>
                        <input
                          type="text"
                          className="ytm-tagger-input"
                          value={taggerTags.title}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g. Blinding Lights"
                        />
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Artist</label>
                        <input
                          type="text"
                          className="ytm-tagger-input"
                          value={taggerTags.artist}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, artist: e.target.value }))}
                          placeholder="e.g. The Weeknd"
                        />
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Album Artist</label>
                        <input
                          type="text"
                          className="ytm-tagger-input"
                          value={taggerTags.albumArtist}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, albumArtist: e.target.value }))}
                          placeholder="e.g. The Weeknd"
                        />
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Album</label>
                        <input
                          type="text"
                          className="ytm-tagger-input"
                          value={taggerTags.album}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, album: e.target.value }))}
                          placeholder="e.g. After Hours"
                        />
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Composer</label>
                        <input
                          type="text"
                          className="ytm-tagger-input"
                          value={taggerTags.composer}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, composer: e.target.value }))}
                          placeholder="e.g. Max Martin"
                        />
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Publisher</label>
                        <input
                          type="text"
                          className="ytm-tagger-input"
                          value={taggerTags.publisher}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, publisher: e.target.value }))}
                          placeholder="e.g. Republic Records"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="ytm-tagger-row" style={{ flex: 1 }}>
                          <label className="ytm-tagger-label">Year</label>
                          <input
                            type="text"
                            className="ytm-tagger-input"
                            value={taggerTags.year}
                            onChange={(e) => setTaggerTags(prev => ({ ...prev, year: e.target.value }))}
                            placeholder="e.g. 2020"
                          />
                        </div>
                        <div className="ytm-tagger-row" style={{ flex: 1 }}>
                          <label className="ytm-tagger-label">Track #</label>
                          <input
                            type="text"
                            className="ytm-tagger-input"
                            value={taggerTags.trackNumber}
                            onChange={(e) => setTaggerTags(prev => ({ ...prev, trackNumber: e.target.value }))}
                            placeholder="e.g. 1"
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="ytm-tagger-row" style={{ flex: 1 }}>
                          <label className="ytm-tagger-label">Disc #</label>
                          <input
                            type="text"
                            className="ytm-tagger-input"
                            value={taggerTags.discNumber}
                            onChange={(e) => setTaggerTags(prev => ({ ...prev, discNumber: e.target.value }))}
                            placeholder="e.g. 1"
                          />
                        </div>
                        <div className="ytm-tagger-row" style={{ flex: 1 }}>
                          <label className="ytm-tagger-label">BPM</label>
                          <input
                            type="text"
                            className="ytm-tagger-input"
                            value={taggerTags.bpm}
                            onChange={(e) => setTaggerTags(prev => ({ ...prev, bpm: e.target.value }))}
                            placeholder="e.g. 120"
                          />
                        </div>
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Genre</label>
                        <input
                          type="text"
                          className="ytm-tagger-input"
                          value={taggerTags.genre}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, genre: e.target.value }))}
                          placeholder="e.g. Pop"
                        />
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Comment</label>
                        <textarea
                          className="ytm-tagger-input"
                          style={{ resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
                          value={taggerTags.comment}
                          onChange={(e) => setTaggerTags(prev => ({ ...prev, comment: e.target.value }))}
                          placeholder="Add comment..."
                        />
                      </div>

                      <div className="ytm-tagger-row">
                        <label className="ytm-tagger-label">Cover Art Source</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="ytm-tagger-input"
                            style={{ flex: 1 }}
                            value={taggerTags.coverArtUrl.startsWith('data:') ? '[Local Image Loaded]' : taggerTags.coverArtUrl}
                            onChange={(e) => setTaggerTags(prev => ({ ...prev, coverArtUrl: e.target.value }))}
                            placeholder="Paste cover image URL..."
                            disabled={taggerTags.coverArtUrl.startsWith('data:')}
                          />
                          {taggerTags.coverArtUrl.startsWith('data:') && (
                            <button
                              className="file-action-btn btn-delete"
                              style={{ margin: 0, padding: '0 8px', height: '38px', minWidth: '38px' }}
                              onClick={() => setTaggerTags(prev => ({ ...prev, coverArtUrl: '' }))}
                              title="Clear Local Image"
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <button
                            className="glow-btn"
                            style={{ margin: 0, padding: '0 12px', height: '38px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                            onClick={() => document.getElementById('local-cover-input').click()}
                            type="button"
                          >
                            Browse Local...
                          </button>
                          <button
                            className="glow-btn"
                            style={{ margin: 0, padding: '0 12px', height: '38px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                            onClick={openArchivesPicker}
                            type="button"
                          >
                            Archives...
                          </button>
                          <input
                            type="file"
                            id="local-cover-input"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleLocalCoverChange}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="ytm-tagger-artwork-block">
                      <div className="ytm-tagger-artwork-container">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current Tag Cover</span>
                        {taggerCoverArt ? (
                          <img src={taggerCoverArt} alt="Current Cover Art" className="ytm-tagger-cover-preview" />
                        ) : (
                          <div className="ytm-tagger-cover-placeholder">
                            <Music size={24} style={{ opacity: 0.3 }} />
                            <span>No Embedded Art</span>
                          </div>
                        )}
                      </div>

                      {taggerTags.coverArtUrl && (
                        <div className="ytm-tagger-artwork-container">
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)' }}>New Match Cover</span>
                          <img src={taggerTags.coverArtUrl} alt="New Cover Art Match" className="ytm-tagger-cover-preview matched" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Panel: MusicBrainz Integration */}
                  <div className="ytm-tagger-column mb-panel">
                    <h3 className="ytm-tagger-section-title">MusicBrainz Search</h3>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <input
                        type="text"
                        className="search-input"
                        style={{ paddingLeft: '16px', height: '38px' }}
                        value={mbSearchQuery}
                        onChange={(e) => setMbSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleMbSearch(); }}
                        placeholder="Search recording or artist..."
                      />
                      <button
                        className="glow-btn modal-btn btn-action"
                        onClick={handleMbSearch}
                        disabled={searchingMb}
                        style={{ margin: 0, padding: '0 16px', height: '38px', whiteSpace: 'nowrap' }}
                      >
                        {searchingMb ? 'Searching...' : 'Search'}
                      </button>
                    </div>

                    <div className="ytm-mb-results-wrapper">
                      {searchingMb && (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                          <RefreshCw className="spin" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 8px auto' }} size={20} />
                          <span>Contacting MusicBrainz...</span>
                        </div>
                      )}

                      {!searchingMb && mbResults.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px 16px', border: '1px dashed var(--glass-border)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                          Search MusicBrainz database above to fetch correct tags!
                        </div>
                      )}

                      {!searchingMb && mbResults.length > 0 && (
                        <div className="ytm-mb-results-list">
                          {mbResults.map(res => (
                            <div
                              key={res.id}
                              className={`ytm-mb-result-item ${selectedMbMatch?.id === res.id ? 'active' : ''}`}
                              onClick={() => handleSelectMbMatch(res)}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                <span className="title" style={{ color: '#fff' }}>{res.title}</span>
                                {res.duration && <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatTime(res.duration)}</span>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                <span>Artist: <strong>{res.artist || 'Unknown'}</strong></span>
                              </div>
                              {res.releases && res.releases.length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Album: {res.releases[0].title} {res.releases[0].date && `(${res.releases[0].date.substring(0, 4)})`}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Match Comparison Block */}
                    {selectedMbMatch && (
                      <div className="ytm-mb-comparison glass-panel">
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          <div style={{ flexGrow: 1 }}>
                            <h4 style={{ color: 'var(--accent-indigo)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Selected Match Details</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.75rem' }}>
                              <span><strong>Title:</strong> {selectedMbMatch.title}</span>
                              <span><strong>Artist:</strong> {selectedMbMatch.artist}</span>
                              {selectedMbMatch.releases && selectedMbMatch.releases.length > 0 && (
                                <>
                                  <span><strong>Album:</strong> {selectedMbMatch.releases[0].title}</span>
                                  <span><strong>Year:</strong> {selectedMbMatch.releases[0].date || 'Unknown'}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {fetchingMbCover ? (
                            <div className="comparison-cover-placeholder">
                              <RefreshCw className="spin" size={14} style={{ animation: 'spin 1.5s linear' }} />
                            </div>
                          ) : mbCoverUrl ? (
                            <img src={mbCoverUrl} alt="Match Cover" className="comparison-cover-art" />
                          ) : (
                            <div className="comparison-cover-placeholder">
                              <Music size={14} style={{ opacity: 0.3 }} />
                            </div>
                          )}
                        </div>

                        <button
                          className="glow-btn match-apply-btn"
                          onClick={applyMbMatch}
                        >
                          Pull Matched Metadata
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <footer className="modal-footer">
                {!taggerFile?.originalName.toLowerCase().endsWith('.mp3') ? (
                  <span style={{ marginRight: 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    * Non-MP3 files: database only metadata edit (physical tagging disabled)
                  </span>
                ) : (
                  <button
                    className="modal-btn"
                    onClick={submitToMusicBrainz}
                    title="Seed this metadata back to MusicBrainz"
                    style={{ color: 'var(--accent-indigo)', marginRight: 'auto' }}
                    type="button"
                  >
                    Submit to MusicBrainz
                  </button>
                )}
                <button className="modal-btn" onClick={() => setTaggerFile(null)}>
                  Cancel
                </button>
                <button
                  className="modal-btn btn-action"
                  onClick={handleSaveTags}
                  disabled={savingTags || loadingTaggerData}
                >
                  {savingTags ? 'Writing Tags...' : 'Save & Tag File'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Archives Image Picker Modal Overlay */}
        {showArchivesPicker && (
          <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setShowArchivesPicker(false)}>
            <div className="modal-container glass-panel" style={{ maxWidth: '550px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <span className="modal-title-text">Select Image from Archives</span>
                <button className="modal-close-btn" onClick={() => setShowArchivesPicker(false)}>
                  <X size={18} />
                </button>
              </header>

              <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {loadingArchivesImages ? (
                  <div style={{ textAlign: 'center', padding: '32px' }}>
                    <RefreshCw className="spin" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 8px auto' }} size={24} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading Archives images...</span>
                  </div>
                ) : archivesImages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', border: '1px dashed var(--glass-border)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                    No images found in G00J Archives. Upload images first!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '4px' }}>
                    {archivesImages.map(img => (
                      <div
                        key={img.id}
                        className="ytm-archives-img-option"
                        onClick={() => {
                          setTaggerTags(prev => ({
                            ...prev,
                            coverArtUrl: getFileDownloadUrl(img)
                          }));
                          setShowArchivesPicker(false);
                        }}
                      >
                        <img
                          src={getFileDownloadUrl(img)}
                          alt={img.originalName}
                        />
                        <div className="name-label" title={img.originalName}>
                          {img.originalName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <footer className="modal-footer">
                <button className="modal-btn" onClick={() => setShowArchivesPicker(false)}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Music Distribution Modal Overlay */}
        {showDistributeModal && distributeFile && (
          <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setShowDistributeModal(false)}>
            <div className="modal-container glass-panel" style={{ maxWidth: '850px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <span className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Radio size={18} style={{ color: 'var(--accent-indigo)' }} />
                  Music Distribution Hub
                </span>
                <button className="modal-close-btn" onClick={() => setShowDistributeModal(false)}>
                  <X size={18} />
                </button>
              </header>

              {loadingDistributeData ? (
                <div className="empty-state" style={{ padding: '60px' }}>
                  <RefreshCw className="empty-icon spin" style={{ animation: 'spin 1.5s linear infinite' }} size={36} />
                  <p>Reading metadata for distribution...</p>
                </div>
              ) : (
                <div className="ytm-tagger-layout" style={{ height: '55vh' }}>
                  {/* Left Column: Metadata Details */}
                  <div className="ytm-tagger-column" style={{ borderRight: '1px solid rgba(255, 255, 255, 0.05)', paddingRight: '20px' }}>
                    <h3 className="ytm-tagger-section-title">Release Metadata</h3>

                    <div className="ytm-tagger-form" style={{ gap: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>File name</span>
                        <span style={{ fontSize: '0.85rem', color: '#fff', wordBreak: 'break-all' }}>{distributeFile.originalName}</span>
                      </div>

                      {[
                        { label: 'Title', value: distributeTags?.title || distributeFile.originalName },
                        { label: 'Artist', value: distributeTags?.artist || 'Unknown Artist' },
                        { label: 'Album Artist', value: distributeTags?.albumArtist || distributeTags?.artist || 'Unknown Artist' },
                        { label: 'Album', value: distributeTags?.album || 'Single' },
                        { label: 'Composer', value: distributeTags?.composer || 'N/A' },
                        { label: 'Publisher', value: distributeTags?.publisher || 'N/A' },
                        { label: 'Genre', value: distributeTags?.genre || 'N/A' },
                        { label: 'Year', value: distributeTags?.year || 'N/A' },
                        { label: 'Track #', value: distributeTags?.trackNumber || 'N/A' },
                        { label: 'Disc #', value: distributeTags?.discNumber || 'N/A' },
                        { label: 'BPM', value: distributeTags?.bpm || 'N/A' },
                        { label: 'Comment', value: distributeTags?.comment || 'N/A' }
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
                          <span style={{ color: '#fff', textAlign: 'right', maxWidth: '70%', wordBreak: 'break-word' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      className="glow-btn"
                      style={{ marginTop: '16px', height: '36px', fontSize: '0.8rem' }}
                      onClick={() => {
                        const reportText = `DISTRIBUTION METADATA REPORT
=============================
File: ${distributeFile.originalName}
Title: ${distributeTags?.title || ''}
Artist: ${distributeTags?.artist || ''}
Album Artist: ${distributeTags?.albumArtist || ''}
Album: ${distributeTags?.album || ''}
Composer: ${distributeTags?.composer || ''}
Publisher: ${distributeTags?.publisher || ''}
Year: ${distributeTags?.year || ''}
Genre: ${distributeTags?.genre || ''}
Track Number: ${distributeTags?.trackNumber || ''}
Disc Number: ${distributeTags?.discNumber || ''}
BPM: ${distributeTags?.bpm || ''}
Comment: ${distributeTags?.comment || ''}
`;
                        navigator.clipboard.writeText(reportText);
                        alert('Metadata copied to clipboard!');
                      }}
                    >
                      Copy Release Metadata
                    </button>
                  </div>

                  {/* Right Column: Distributors */}
                  <div className="ytm-tagger-column" style={{ paddingLeft: '12px' }}>
                    <h3 className="ytm-tagger-section-title">Select Music Distributor</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        {
                          name: 'Ditto Music',
                          desc: 'Unlimited distribution to Spotify, Apple Music, TikTok & more. Keep 100% of your royalties.',
                          url: 'https://v2.dittomusic.com/login',
                          color: 'var(--accent-indigo)'
                        },
                        {
                          name: 'Too Lost',
                          desc: 'Premium distribution, publishing administration, split sheets, and marketing tools.',
                          url: 'https://dashboard.toolost.com/',
                          color: '#00e575'
                        },
                        {
                          name: 'BandLab Distribution',
                          desc: 'Distribute directly from BandLab creator hub to all digital music stores and streaming services.',
                          url: 'https://creator.bandlab.com/',
                          color: '#ff3366'
                        },
                        {
                          name: 'UnitedMasters',
                          desc: 'Distribute your music, track analytics, and get brand/sync opportunities with NBA, ESPN, etc.',
                          url: 'https://unitedmasters.com/login',
                          color: '#fff'
                        },
                        {
                          name: 'TuneCore',
                          desc: 'One of the largest global music distributors. Distribute unlimited releases worldwide.',
                          url: 'https://www.tunecore.com/dashboard',
                          color: '#ffa500'
                        }
                      ].map(platform => (
                        <div
                          key={platform.name}
                          className="glass-panel"
                          style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--glass-border)', borderRadius: '8px', textAlign: 'left', background: 'rgba(255, 255, 255, 0.01)' }}
                        >
                          <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, color: platform.color, fontSize: '0.95rem' }}>{platform.name}</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>{platform.desc}</p>
                          <button
                            className="glow-btn"
                            style={{ margin: '8px 0 0 0', height: '34px', fontSize: '0.75rem', alignSelf: 'flex-start', background: 'rgba(255,255,255,0.03)' }}
                            onClick={() => {
                              // Trigger zip package generation download
                              window.location.href = `${API_BASE}/api/files/${distributeFile.id}/distribute`;
                              // Open portal console in a new tab
                              window.open(platform.url, '_blank');
                            }}
                          >
                            Distribute & Open Portal
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <footer className="modal-footer">
                <button className="modal-btn" onClick={() => setShowDistributeModal(false)}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}

        {showShareModal && shareTarget && (
          <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
            <div className="modal-container glass-panel" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <span className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Share2 size={18} style={{ color: 'var(--accent-indigo)' }} />
                  Share {shareTargetType === 'folder' ? 'Folder' : 'File'}
                </span>
                <button className="modal-close-btn" onClick={() => setShowShareModal(false)}>
                  <X size={18} />
                </button>
              </header>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                <p className="drag-text-sub" style={{ fontSize: '0.85rem' }}>
                  Anyone with this link will have read-only access to view, preview, and download this {shareTargetType === 'folder' ? 'folder and all of its contents' : 'file'}.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{shareTargetType === 'folder' ? 'Folder Name' : 'File Name'}</span>
                  <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600, wordBreak: 'break-all' }}>
                    {shareTargetType === 'folder' ? shareTarget.name : (shareTarget.originalName || shareTarget.name)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    type="text"
                    className="search-input"
                    readOnly
                    value={`${getShareUrlBase()}/?${shareTargetType === 'folder' ? 'shareFolder' : 'shareFile'}=${shareTarget.id}`}
                    style={{ paddingLeft: '12px', fontSize: '0.85rem' }}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    className="glow-btn modal-btn btn-action"
                    style={{ margin: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      const url = `${getShareUrlBase()}/?${shareTargetType === 'folder' ? 'shareFolder' : 'shareFile'}=${shareTarget.id}`;
                      navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Copy size={14} />
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <footer className="modal-footer">
                <button className="modal-btn" onClick={() => setShowShareModal(false)}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* Change Vault Password Modal Overlay */}
        {showChangeVaultPasswordModal && (
          <div className="modal-overlay" onClick={() => setShowChangeVaultPasswordModal(false)}>
            <div className="modal-container glass-panel" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <span className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={18} style={{ color: 'var(--accent-indigo)' }} />
                  Change Vault Key
                </span>
                <button className="modal-close-btn" onClick={() => setShowChangeVaultPasswordModal(false)}>
                  <X size={18} />
                </button>
              </header>

              <form onSubmit={handleChangeVaultPassword}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                  {vaultRotationError && (
                    <div className="admin-alert-box error" style={{ marginBottom: '8px' }}>
                      <AlertCircle size={14} />
                      <span>{vaultRotationError}</span>
                    </div>
                  )}
                  {vaultRotationSuccess && (
                    <div className="admin-alert-box success" style={{ marginBottom: '8px' }}>
                      <span>{vaultRotationSuccess}</span>
                    </div>
                  )}
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Changing your vault key will decrypt all existing vault files locally and re-encrypt them under your new password. This process may take a few seconds depending on file sizes.
                  </p>
                  <div className="login-input-group">
                    <label className="login-input-label">New Password</label>
                    <input
                      type="password"
                      className="search-input"
                      placeholder="Enter new password"
                      value={newVaultPasswordInput}
                      onChange={(e) => setNewVaultPasswordInput(e.target.value)}
                      required
                      style={{ paddingLeft: '12px' }}
                    />
                  </div>
                  <div className="login-input-group">
                    <label className="login-input-label">Confirm New Password</label>
                    <input
                      type="password"
                      className="search-input"
                      placeholder="Confirm new password"
                      value={confirmNewVaultPasswordInput}
                      onChange={(e) => setConfirmNewVaultPasswordInput(e.target.value)}
                      required
                      style={{ paddingLeft: '12px' }}
                    />
                  </div>
                </div>

                <footer className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" className="modal-btn" onClick={() => setShowChangeVaultPasswordModal(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                    Cancel
                  </button>
                  <button type="submit" className="glow-btn btn-action" style={{ margin: 0, padding: '8px 20px' }}>
                    Rotate Key
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

        {/* Image Editor Modal Overlay */}
        {showImageEditor && editorFile && (
          <div className="image-editor-overlay">
            <div className="image-editor-container glass-panel">
              {/* Editor Topbar */}
              <header className="editor-topbar">
                <div className="editor-info-block">
                  <ImageIcon size={18} className="editor-logo-icon" style={{ color: 'var(--accent-indigo)' }} />
                  <span className="editor-title">Picsart Studio</span>
                  <span className="editor-divider">|</span>
                  <span className="editor-filename" title={editorFile.originalName}>{editorFile.originalName}</span>
                </div>
                
                <div className="editor-history-controls">
                  <button
                    className="editor-history-btn"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    title="Undo"
                  >
                    <Undo size={15} />
                  </button>
                  <button
                    className="editor-history-btn"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    title="Redo"
                  >
                    <Redo size={15} />
                  </button>
                  <button
                    className="editor-history-btn"
                    onClick={handleResetEditor}
                    title="Reset Edits"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <div className="editor-topbar-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="modal-btn"
                    onClick={() => {
                      if (window.confirm('Discard all unsaved edits?')) {
                        setShowImageEditor(false);
                      }
                    }}
                    style={{ background: 'transparent', border: '1px solid var(--glass-border)', margin: 0 }}
                  >
                    Cancel
                  </button>
                  <button
                    className="glow-btn editor-save-btn"
                    onClick={() => setSaveModalOpen(true)}
                    style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '6px', height: '38px', fontSize: '0.85rem' }}
                  >
                    <Save size={14} />
                    Save Edits
                  </button>
                </div>
              </header>

              {/* Editor Workspace */}
              <div className="editor-workspace">
                <div className="editor-canvas-area">
                  <div className="canvas-scroll-container">
                    <canvas
                      ref={canvasRef}
                      width={canvasWidth}
                      height={canvasHeight}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      className={`editor-canvas ${brushMode !== 'off' ? 'canvas-brush-cursor' : 'canvas-normal-cursor'}`}
                    />
                  </div>
                  {(selectedTextId || selectedStickerId) && (
                    <div className="editor-floating-help">
                      <Info size={12} />
                      <span>Drag to position. Use sidebar attributes to style, or click (×) to delete layer.</span>
                    </div>
                  )}
                </div>

                {/* Sidebar Menu Panel */}
                <aside className="editor-sidebar glass-panel">
                  <div className="editor-sidebar-tabs">
                    {[
                      { id: 'adjust', label: 'Adjust', icon: <Sliders size={16} /> },
                      { id: 'filter', label: 'Filters', icon: <ImageIcon size={16} /> },
                      { id: 'draw', label: 'Draw', icon: <Edit3 size={16} /> },
                      { id: 'text', label: 'Text', icon: <Type size={16} /> },
                      { id: 'shapes', label: 'Shapes', icon: <Plus size={16} /> },
                      { id: 'resize', label: 'Resize', icon: <Maximize2 size={16} /> }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        className={`editor-tab-btn ${editorActiveTab === tab.id ? 'active' : ''}`}
                        onClick={() => setEditorActiveTab(tab.id)}
                        title={tab.label}
                      >
                        {tab.icon}
                        <span className="tab-label-text">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="editor-sidebar-content">
                    {editorActiveTab === 'adjust' && (
                      <div className="editor-tab-pane">
                        <h3 className="sidebar-section-title">Color Adjustments</h3>
                        {[
                          { label: 'Brightness', min: 0, max: 200, val: brightness, set: setBrightness, unit: '%' },
                          { label: 'Contrast', min: 0, max: 200, val: contrast, set: setContrast, unit: '%' },
                          { label: 'Saturation', min: 0, max: 200, val: saturation, set: setSaturation, unit: '%' },
                          { label: 'Exposure', min: 0, max: 200, val: exposure, set: setExposure, unit: '%' },
                          { label: 'Hue Rotate', min: 0, max: 360, val: hue, set: setHue, unit: '°' },
                          { label: 'Blur', min: 0, max: 20, val: blur, set: setBlur, unit: 'px' },
                          { label: 'Opacity', min: 0, max: 100, val: opacity, set: setOpacity, unit: '%' }
                        ].map(slider => (
                          <div key={slider.label} className="editor-control-group">
                            <div className="control-label-row">
                              <span className="control-label">{slider.label}</span>
                              <span className="control-value">{slider.val}{slider.unit}</span>
                            </div>
                            <input
                              type="range"
                              min={slider.min}
                              max={slider.max}
                              value={slider.val}
                              onChange={(e) => slider.set(parseInt(e.target.value))}
                              onMouseUp={() => pushHistory(drawings, texts, shapes, {
                                brightness: slider.label === 'Brightness' ? parseInt(slider.val) : brightness,
                                contrast: slider.label === 'Contrast' ? parseInt(slider.val) : contrast,
                                saturation: slider.label === 'Saturation' ? parseInt(slider.val) : saturation,
                                exposure: slider.label === 'Exposure' ? parseInt(slider.val) : exposure,
                                hue: slider.label === 'Hue Rotate' ? parseInt(slider.val) : hue,
                                blur: slider.label === 'Blur' ? parseInt(slider.val) : blur,
                                opacity: slider.label === 'Opacity' ? parseInt(slider.val) : opacity,
                                warmth,
                                selectedFilter
                              })}
                              className="editor-range-slider"
                            />
                          </div>
                        ))}
                        
                        <div className="editor-control-group">
                          <div className="control-label-row">
                            <span className="control-label">Warmth / Temperature</span>
                            <span className="control-value">{warmth > 0 ? `+${warmth}` : warmth}</span>
                          </div>
                          <input
                            type="range"
                            min={-50}
                            max={50}
                            value={warmth}
                            onChange={(e) => setWarmth(parseInt(e.target.value))}
                            onMouseUp={() => pushHistory(drawings, texts, shapes, {
                              brightness, contrast, saturation, exposure, hue, blur, opacity,
                              warmth: parseInt(warmth), selectedFilter
                            })}
                            className="editor-range-slider"
                          />
                        </div>
                      </div>
                    )}

                    {editorActiveTab === 'filter' && (
                      <div className="editor-tab-pane">
                        <h3 className="sidebar-section-title">Photo Filters</h3>
                        <div className="editor-filter-grid">
                          {[
                            { id: 'none', label: 'Original' },
                            { id: 'sepia', label: 'Sepia Vintage' },
                            { id: 'grayscale', label: 'Black & White' },
                            { id: 'invert', label: 'Invert Color' },
                            { id: 'vintage', label: 'Retro Warm' },
                            { id: 'retro', label: 'Vibrant Pop' },
                            { id: 'cool', label: 'Cool Indigo' },
                            { id: 'warm', label: 'Amber Glow' },
                            { id: 'noir', label: 'Dark Noir' }
                          ].map(filt => (
                            <button
                              key={filt.id}
                              className={`editor-filter-card ${selectedFilter === filt.id ? 'active' : ''}`}
                              onClick={() => {
                                setSelectedFilter(filt.id);
                                pushHistory(drawings, texts, shapes, {
                                  brightness, contrast, saturation, exposure, hue, blur, opacity, warmth,
                                  selectedFilter: filt.id
                                });
                              }}
                            >
                              <div className={`filter-preview-thumbnail filter-mode-${filt.id}`}></div>
                              <span className="filter-label-text">{filt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editorActiveTab === 'draw' && (
                      <div className="editor-tab-pane">
                        <h3 className="sidebar-section-title">Brush Draw & Erase</h3>
                        <div className="editor-mode-toggle-group">
                          <button
                            className={`editor-mode-toggle-btn ${brushMode === 'off' ? 'active' : ''}`}
                            onClick={() => setBrushMode('off')}
                          >
                            Selection Mode
                          </button>
                          <button
                            className={`editor-mode-toggle-btn ${brushMode === 'draw' ? 'active' : ''}`}
                            onClick={() => setBrushMode('draw')}
                          >
                            Brush
                          </button>
                          <button
                            className={`editor-mode-toggle-btn ${brushMode === 'erase' ? 'active' : ''}`}
                            onClick={() => setBrushMode('erase')}
                          >
                            Eraser
                          </button>
                        </div>

                        {brushMode !== 'off' && (
                          <>
                            {brushMode === 'draw' && (
                              <div className="editor-control-group">
                                <label className="control-label">Brush Color</label>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                  <input
                                    type="color"
                                    value={brushColor}
                                    onChange={(e) => setBrushColor(e.target.value)}
                                    className="editor-color-picker"
                                  />
                                  <input
                                    type="text"
                                    value={brushColor}
                                    onChange={(e) => setBrushColor(e.target.value)}
                                    className="search-input"
                                    style={{ height: '36px', paddingLeft: '12px' }}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">{brushMode === 'erase' ? 'Eraser' : 'Brush'} Size</span>
                                <span className="control-value">{brushSize}px</span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={100}
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                className="editor-range-slider"
                              />
                            </div>

                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Opacity</span>
                                <span className="control-value">{brushOpacity}%</span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={100}
                                value={brushOpacity}
                                onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
                                className="editor-range-slider"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {editorActiveTab === 'text' && (
                      <div className="editor-tab-pane">
                        <h3 className="sidebar-section-title">Text Overlays</h3>
                        <div className="editor-control-group">
                          <textarea
                            placeholder="Add overlay text..."
                            value={inputText}
                            onChange={(e) => {
                              setInputText(e.target.value);
                              if (selectedTextId) updateSelectedText('text', e.target.value);
                            }}
                            onBlur={() => {
                              if (selectedTextId) commitSelectedTextHistory();
                            }}
                            className="search-input"
                            style={{ height: '80px', borderRadius: '8px', padding: '12px', resize: 'vertical' }}
                          />
                          {!selectedTextId && (
                            <button
                              className="glow-btn"
                              onClick={handleAddText}
                              style={{ width: '100%', marginTop: '8px', height: '36px', fontSize: '0.85rem' }}
                            >
                              <Plus size={14} /> Add Text Layer
                            </button>
                          )}
                        </div>

                        {selectedTextId && (
                          <>
                            <div className="editor-control-group">
                              <label className="control-label">Font Family</label>
                              <select
                                value={texts.find(t => t.id === selectedTextId)?.fontFamily || 'Outfit'}
                                onChange={(e) => {
                                  updateSelectedText('fontFamily', e.target.value);
                                  commitSelectedTextHistory();
                                }}
                                className="editor-select"
                              >
                                <option value="Outfit">Outfit</option>
                                <option value="Plus Jakarta Sans">Plus Jakarta</option>
                                <option value="monospace">Monospace</option>
                                <option value="serif">Serif</option>
                                <option value="sans-serif">Sans Serif</option>
                                <option value="cursive">Cursive</option>
                              </select>
                            </div>

                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Font Size</span>
                                <span className="control-value">{texts.find(t => t.id === selectedTextId)?.fontSize || 36}px</span>
                              </div>
                              <input
                                type="range"
                                min={8}
                                max={150}
                                value={texts.find(t => t.id === selectedTextId)?.fontSize || 36}
                                onChange={(e) => updateSelectedText('fontSize', parseInt(e.target.value))}
                                onMouseUp={commitSelectedTextHistory}
                                className="editor-range-slider"
                              />
                            </div>

                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Rotation Angle</span>
                                <span className="control-value">{texts.find(t => t.id === selectedTextId)?.angle || 0}°</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={360}
                                value={texts.find(t => t.id === selectedTextId)?.angle || 0}
                                onChange={(e) => updateSelectedText('angle', parseInt(e.target.value))}
                                onMouseUp={commitSelectedTextHistory}
                                className="editor-range-slider"
                              />
                            </div>

                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Layer Opacity</span>
                                <span className="control-value">{texts.find(t => t.id === selectedTextId)?.opacity || 100}%</span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={100}
                                value={texts.find(t => t.id === selectedTextId)?.opacity || 100}
                                onChange={(e) => updateSelectedText('opacity', parseInt(e.target.value))}
                                onMouseUp={commitSelectedTextHistory}
                                className="editor-range-slider"
                              />
                            </div>

                            <div className="editor-control-group">
                              <label className="control-label">Text Color</label>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <input
                                  type="color"
                                  value={texts.find(t => t.id === selectedTextId)?.color || '#ffffff'}
                                  onChange={(e) => updateSelectedText('color', e.target.value)}
                                  onBlur={commitSelectedTextHistory}
                                  className="editor-color-picker"
                                />
                                <input
                                  type="text"
                                  value={texts.find(t => t.id === selectedTextId)?.color || '#ffffff'}
                                  onChange={(e) => updateSelectedText('color', e.target.value)}
                                  onBlur={commitSelectedTextHistory}
                                  className="search-input"
                                  style={{ height: '36px', paddingLeft: '12px' }}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                              <button
                                className={`editor-mode-toggle-btn ${texts.find(t => t.id === selectedTextId)?.bold ? 'active' : ''}`}
                                onClick={() => {
                                  const current = texts.find(t => t.id === selectedTextId)?.bold;
                                  updateSelectedText('bold', !current);
                                  commitSelectedTextHistory();
                                }}
                                style={{ flex: 1 }}
                              >
                                Bold
                              </button>
                              <button
                                className={`editor-mode-toggle-btn ${texts.find(t => t.id === selectedTextId)?.italic ? 'active' : ''}`}
                                onClick={() => {
                                  const current = texts.find(t => t.id === selectedTextId)?.italic;
                                  updateSelectedText('italic', !current);
                                  commitSelectedTextHistory();
                                }}
                                style={{ flex: 1 }}
                              >
                                Italic
                              </button>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '16px 0' }} />

                            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-indigo)', marginBottom: '8px' }}>Text Border Outline</h4>
                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Outline Stroke Width</span>
                                <span className="control-value">{texts.find(t => t.id === selectedTextId)?.borderWidth || 0}px</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={15}
                                value={texts.find(t => t.id === selectedTextId)?.borderWidth || 0}
                                onChange={(e) => updateSelectedText('borderWidth', parseInt(e.target.value))}
                                onMouseUp={commitSelectedTextHistory}
                                className="editor-range-slider"
                              />
                            </div>

                            <div className="editor-control-group">
                              <label className="control-label">Outline Color</label>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <input
                                  type="color"
                                  value={texts.find(t => t.id === selectedTextId)?.borderColor || '#000000'}
                                  onChange={(e) => updateSelectedText('borderColor', e.target.value)}
                                  onBlur={commitSelectedTextHistory}
                                  className="editor-color-picker"
                                />
                                <input
                                  type="text"
                                  value={texts.find(t => t.id === selectedTextId)?.borderColor || '#000000'}
                                  onChange={(e) => updateSelectedText('borderColor', e.target.value)}
                                  onBlur={commitSelectedTextHistory}
                                  className="search-input"
                                  style={{ height: '36px', paddingLeft: '12px' }}
                                />
                              </div>
                            </div>

                            <button
                              className="modal-btn btn-action btn-delete"
                              onClick={() => {
                                const updated = texts.filter(t => t.id !== selectedTextId);
                                setTexts(updated);
                                setSelectedTextId(null);
                                pushHistory(drawings, updated, shapes, getAdjustmentsState());
                              }}
                              style={{ width: '100%', marginTop: '12px', height: '36px', fontSize: '0.85rem' }}
                            >
                              Delete Text Layer
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {editorActiveTab === 'shapes' && (
                      <div className="editor-tab-pane">
                        <h3 className="sidebar-section-title">Stickers & Vector Shapes</h3>
                        <div className="editor-shapes-presets">
                          <button className="editor-shape-btn" onClick={() => handleAddShape('rect')}>Rectangle</button>
                          <button className="editor-shape-btn" onClick={() => handleAddShape('circle')}>Circle</button>
                          <button className="editor-shape-btn" onClick={() => handleAddShape('line')}>Line</button>
                          <button className="editor-shape-btn" onClick={() => handleAddShape('arrow')}>Arrow</button>
                        </div>

                        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-indigo)', margin: '16px 0 8px 0' }}>Stickers / Emojis</h4>
                        <div className="editor-stickers-grid">
                          {['🔥', '🚀', '❤️', '😂', '👍', '🎉', '⭐', '💡', '💎', '🍀', '✨', '⚡', '💥', '🎨', '📸', '🎵', '👽', '👑', '🌈', '💀'].map(emoji => (
                            <button
                              key={emoji}
                              className="editor-sticker-option"
                              onClick={() => handleAddSticker(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {selectedStickerId && (
                          <>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '16px 0' }} />
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-indigo)', marginBottom: '8px' }}>Layer Properties</h4>
                            
                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Width Size</span>
                                <span className="control-value">{shapes.find(s => s.id === selectedStickerId)?.width || 100}px</span>
                              </div>
                              <input
                                type="range"
                                min={10}
                                max={500}
                                value={shapes.find(s => s.id === selectedStickerId)?.width || 100}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  const targetShape = shapes.find(s => s.id === selectedStickerId);
                                  if (targetShape && !['rect', 'circle', 'line', 'arrow'].includes(targetShape.type)) {
                                    updateSelectedShape('width', val);
                                    updateSelectedShape('height', val);
                                  } else {
                                    updateSelectedShape('width', val);
                                  }
                                }}
                                onMouseUp={commitSelectedShapeHistory}
                                className="editor-range-slider"
                              />
                            </div>

                            {['rect', 'circle', 'line', 'arrow'].includes(shapes.find(s => s.id === selectedStickerId)?.type) && (
                              <div className="editor-control-group">
                                <div className="control-label-row">
                                  <span className="control-label">Height Size</span>
                                  <span className="control-value">{shapes.find(s => s.id === selectedStickerId)?.height || 100}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={10}
                                  max={500}
                                  value={shapes.find(s => s.id === selectedStickerId)?.height || 100}
                                  onChange={(e) => updateSelectedShape('height', parseInt(e.target.value))}
                                  onMouseUp={commitSelectedShapeHistory}
                                  className="editor-range-slider"
                                />
                              </div>
                            )}

                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Rotation Angle</span>
                                <span className="control-value">{shapes.find(s => s.id === selectedStickerId)?.angle || 0}°</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={360}
                                value={shapes.find(s => s.id === selectedStickerId)?.angle || 0}
                                onChange={(e) => updateSelectedShape('angle', parseInt(e.target.value))}
                                onMouseUp={commitSelectedShapeHistory}
                                className="editor-range-slider"
                              />
                            </div>

                            <div className="editor-control-group">
                              <div className="control-label-row">
                                <span className="control-label">Opacity</span>
                                <span className="control-value">{shapes.find(s => s.id === selectedStickerId)?.opacity || 100}%</span>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={100}
                                value={shapes.find(s => s.id === selectedStickerId)?.opacity || 100}
                                onChange={(e) => updateSelectedShape('opacity', parseInt(e.target.value))}
                                onMouseUp={commitSelectedShapeHistory}
                                className="editor-range-slider"
                              />
                            </div>

                            {['rect', 'circle', 'line', 'arrow'].includes(shapes.find(s => s.id === selectedStickerId)?.type) && (
                              <>
                                <div className="editor-control-group">
                                  <div className="control-label-row">
                                    <span className="control-label">Line Thickness</span>
                                    <span className="control-value">{shapes.find(s => s.id === selectedStickerId)?.strokeWidth || 4}px</span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={20}
                                    value={shapes.find(s => s.id === selectedStickerId)?.strokeWidth || 4}
                                    onChange={(e) => updateSelectedShape('strokeWidth', parseInt(e.target.value))}
                                    onMouseUp={commitSelectedShapeHistory}
                                    className="editor-range-slider"
                                  />
                                </div>

                                <div className="editor-control-group">
                                  <label className="control-label">Border/Line Color</label>
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                    <input
                                      type="color"
                                      value={shapes.find(s => s.id === selectedStickerId)?.strokeColor || '#6366f1'}
                                      onChange={(e) => updateSelectedShape('strokeColor', e.target.value)}
                                      onBlur={commitSelectedShapeHistory}
                                      className="editor-color-picker"
                                    />
                                    <input
                                      type="text"
                                      value={shapes.find(s => s.id === selectedStickerId)?.strokeColor || '#6366f1'}
                                      onChange={(e) => updateSelectedShape('strokeColor', e.target.value)}
                                      onBlur={commitSelectedShapeHistory}
                                      className="search-input"
                                      style={{ height: '36px', paddingLeft: '12px' }}
                                    />
                                  </div>
                                </div>

                                {['rect', 'circle'].includes(shapes.find(s => s.id === selectedStickerId)?.type) && (
                                  <div className="editor-control-group">
                                    <label className="control-label">Fill Color</label>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                      <input
                                        type="color"
                                        value={shapes.find(s => s.id === selectedStickerId)?.fillColor === 'transparent' ? '#ffffff' : shapes.find(s => s.id === selectedStickerId)?.fillColor}
                                        disabled={shapes.find(s => s.id === selectedStickerId)?.fillColor === 'transparent'}
                                        onChange={(e) => updateSelectedShape('fillColor', e.target.value)}
                                        onBlur={commitSelectedShapeHistory}
                                        className="editor-color-picker"
                                      />
                                      <button
                                        className={`editor-mode-toggle-btn ${shapes.find(s => s.id === selectedStickerId)?.fillColor === 'transparent' ? 'active' : ''}`}
                                        onClick={() => {
                                          const currentVal = shapes.find(s => s.id === selectedStickerId)?.fillColor;
                                          updateSelectedShape('fillColor', currentVal === 'transparent' ? '#6366f1' : 'transparent');
                                          commitSelectedShapeHistory();
                                        }}
                                        style={{ margin: 0, padding: '0 12px', fontSize: '0.85rem' }}
                                      >
                                        No Fill (Transparent)
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            <button
                              className="modal-btn btn-action btn-delete"
                              onClick={() => {
                                const updated = shapes.filter(s => s.id !== selectedStickerId);
                                setShapes(updated);
                                setSelectedStickerId(null);
                                pushHistory(drawings, texts, updated, getAdjustmentsState());
                              }}
                              style={{ width: '100%', marginTop: '12px', height: '36px', fontSize: '0.85rem' }}
                            >
                              Delete Layer
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {editorActiveTab === 'resize' && (
                      <div className="editor-tab-pane">
                        <h3 className="sidebar-section-title">Picture Resizer Studio</h3>
                        <div className="editor-control-group">
                          <label className="control-label">Width (px)</label>
                          <input
                            type="number"
                            className="search-input"
                            style={{ paddingLeft: '12px', marginTop: '6px' }}
                            value={resizeWidth}
                            onChange={(e) => handleResizeWidthChange(parseInt(e.target.value) || 0)}
                          />
                        </div>

                        <div className="editor-control-group">
                          <label className="control-label">Height (px)</label>
                          <input
                            type="number"
                            className="search-input"
                            style={{ paddingLeft: '12px', marginTop: '6px' }}
                            value={resizeHeight}
                            onChange={(e) => handleResizeHeightChange(parseInt(e.target.value) || 0)}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
                          <input
                            type="checkbox"
                            id="aspect-lock"
                            checked={aspectRatioLock}
                            onChange={(e) => setAspectRatioLock(e.target.checked)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <label htmlFor="aspect-lock" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                            Lock Aspect Ratio ({canvasWidth && canvasHeight ? (canvasWidth / canvasHeight).toFixed(2) : '1.00'})
                          </label>
                        </div>

                        <div className="presets-section" style={{ marginTop: '16px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-indigo)', marginBottom: '8px' }}>Presets</h4>
                          <div className="editor-shapes-presets" style={{ gap: '8px' }}>
                            <button className="editor-shape-btn" onClick={() => { setAspectRatioLock(false); setResizeWidth(1080); setResizeHeight(1080); }}>1080p Square (1:1)</button>
                            <button className="editor-shape-btn" onClick={() => { setAspectRatioLock(false); setResizeWidth(1920); setResizeHeight(1080); }}>1080p HDTV (16:9)</button>
                            <button className="editor-shape-btn" onClick={() => { setAspectRatioLock(false); setResizeWidth(1080); setResizeHeight(1920); }}>9:16 Portrait</button>
                            <button className="editor-shape-btn" onClick={() => { setAspectRatioLock(false); setResizeWidth(800); setResizeHeight(600); }}>800x600 SVGA</button>
                          </div>
                        </div>

                        <div className="presets-section" style={{ marginTop: '16px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-indigo)', marginBottom: '8px' }}>Scale Percentage</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                            {[25, 50, 75, 150, 200].map(pct => (
                              <button
                                key={pct}
                                className="editor-shape-btn"
                                style={{ padding: '6px 0', fontSize: '0.75rem', textAlign: 'center' }}
                                onClick={() => applyPercentScale(pct)}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          className="glow-btn"
                          style={{ width: '100%', marginTop: '20px', height: '38px', fontSize: '0.85rem' }}
                          onClick={handleApplyResize}
                        >
                          Apply New Resolution
                        </button>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '24px 0 16px 0' }} />

                        <h3 className="sidebar-section-title">Center Crop Presets</h3>
                        <div className="editor-shapes-presets" style={{ gap: '8px' }}>
                          <button className="editor-shape-btn" onClick={() => handleCropImage('1:1')}>Crop 1:1 Square</button>
                          <button className="editor-shape-btn" onClick={() => handleCropImage('4:3')}>Crop 4:3</button>
                          <button className="editor-shape-btn" onClick={() => handleCropImage('16:9')}>Crop 16:9 HDTV</button>
                          <button className="editor-shape-btn" onClick={() => handleCropImage('3:2')}>Crop 3:2 Photo</button>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '24px 0 16px 0' }} />

                        <h3 className="sidebar-section-title">Rotate & Flip</h3>
                        <div className="editor-shapes-presets" style={{ gap: '8px' }}>
                          <button className="editor-shape-btn" onClick={handleRotateImage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <RotateCw size={14} /> Rotate 90°
                          </button>
                          <button className="editor-shape-btn" onClick={handleFlipHorizontal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <FlipHorizontal size={14} /> Flip Horiz
                          </button>
                          <button className="editor-shape-btn" onClick={handleFlipVertical} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <FlipVertical size={14} /> Flip Vert
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}

        {/* Save Settings Modal Popup Dialog */}
        {saveModalOpen && (
          <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setSaveModalOpen(false)}>
            <div className="modal-container glass-panel" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <span className="modal-title-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={18} style={{ color: 'var(--accent-indigo)' }} />
                  Save Studio Output
                </span>
                <button className="modal-close-btn" onClick={() => setSaveModalOpen(false)}>
                  <X size={18} />
                </button>
              </header>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                <div className="editor-control-group">
                  <label className="control-label" style={{ fontWeight: 600, color: '#fff' }}>Save Destination</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      className={`editor-mode-toggle-btn ${!saveAsCopy ? 'active' : ''}`}
                      onClick={() => setSaveAsCopy(false)}
                      style={{ flex: 1, height: '36px' }}
                    >
                      Overwrite Original
                    </button>
                    <button
                      className={`editor-mode-toggle-btn ${saveAsCopy ? 'active' : ''}`}
                      onClick={() => setSaveAsCopy(true)}
                      style={{ flex: 1, height: '36px' }}
                    >
                      Save as Copy
                    </button>
                  </div>
                </div>

                {saveAsCopy && (
                  <div className="editor-control-group">
                    <label className="control-label">File Copy Name</label>
                    <input
                      type="text"
                      className="search-input"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="example_edited.png"
                      style={{ paddingLeft: '12px', marginTop: '6px' }}
                    />
                  </div>
                )}

                <div className="editor-control-group">
                  <label className="control-label" style={{ fontWeight: 600, color: '#fff' }}>Image File Format</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      className={`editor-mode-toggle-btn ${saveFormat === 'png' ? 'active' : ''}`}
                      onClick={() => setSaveFormat('png')}
                      style={{ flex: 1, height: '36px' }}
                    >
                      PNG (Lossless)
                    </button>
                    <button
                      className={`editor-mode-toggle-btn ${saveFormat === 'jpeg' ? 'active' : ''}`}
                      onClick={() => setSaveFormat('jpeg')}
                      style={{ flex: 1, height: '36px' }}
                    >
                      JPEG (Compressed)
                    </button>
                  </div>
                </div>

                {saveFormat === 'jpeg' && (
                  <div className="editor-control-group">
                    <div className="control-label-row">
                      <span className="control-label">JPEG Compression Quality</span>
                      <span className="control-value">{Math.round(jpegQuality * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={jpegQuality}
                      onChange={(e) => setJpegQuality(parseFloat(e.target.value))}
                      className="editor-range-slider"
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Canvas Dimensions:</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{canvasWidth} × {canvasHeight} px</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Estimated Output Size:</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{estimatedSize}</span>
                  </div>
                </div>
              </div>

              <footer className="modal-footer" style={{ gap: '10px' }}>
                <button
                  className="modal-btn"
                  style={{ border: '1px solid var(--glass-border)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                  onClick={handleLocalDownload}
                  title="Download directly to your local computer"
                >
                  <Download size={14} />
                  Download Local
                </button>
                
                <div style={{ flexGrow: 1 }} />
                
                <button className="modal-btn" onClick={() => setSaveModalOpen(false)} style={{ margin: 0 }}>
                  Cancel
                </button>
                <button
                  className="modal-btn btn-action"
                  onClick={handleSaveImage}
                  disabled={editorSaving}
                  style={{ margin: 0 }}
                >
                  {editorSaving ? 'Saving Edits...' : 'Save to Cloud'}
                </button>
              </footer>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Bottom YouTube Music Player Bar */}
      {activeAudioTrack && (
        <div className="ytm-player-bar">
          {/* Hidden native audio control tag */}
          <audio
            ref={audioRef}
            onTimeUpdate={() => setCurrentTime(audioRef.current ? audioRef.current.currentTime : 0)}
            onLoadedMetadata={() => setDuration(audioRef.current ? audioRef.current.duration : 0)}
            onEnded={playNext}
            loop={isLooping}
          />

          {/* Left Track Info */}
          <div className="ytm-track-info" onClick={() => setIsPlayerExpanded(true)} style={{ cursor: 'pointer' }}>
            <div className={`ytm-cover-art ${isPlaying ? 'playing' : ''}`}>
              <Music size={20} />
            </div>
            <div className="ytm-track-meta">
              <span className="ytm-track-title" title={activeAudioTrack.title || activeAudioTrack.originalName}>
                {activeAudioTrack.title || activeAudioTrack.originalName}
              </span>
              <span className="ytm-track-desc">
                {activeAudioTrack.artist ? `${activeAudioTrack.artist} • ` : ''}{formatBytes(activeAudioTrack.size)} • Audio
              </span>
            </div>
          </div>

          {/* Middle Controls & Seek Slider */}
          <div className="ytm-player-controls-container">
            <div className="ytm-controls">
              <button className="ytm-control-btn" onClick={playPrev} title="Previous Track">
                <SkipBack size={18} fill="currentColor" />
              </button>
              <button className="ytm-control-btn play-pause" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />}
              </button>
              <button className="ytm-control-btn" onClick={playNext} title="Next Track">
                <SkipForward size={18} fill="currentColor" />
              </button>
            </div>

            <div className="ytm-progress-bar-wrapper">
              <span className="ytm-time-text">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="ytm-progress-slider"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
              />
              <span className="ytm-time-text">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Extra Actions (loop, shuffle, volume) */}
          <div className="ytm-extra-controls">
            <button
              className={`ytm-extra-btn ${isLooping ? 'active' : ''}`}
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? "Repeat: On" : "Repeat: Off"}
            >
              <Repeat size={16} />
            </button>
            <button
              className={`ytm-extra-btn ${isShuffled ? 'active' : ''}`}
              onClick={() => setIsShuffled(!isShuffled)}
              title={isShuffled ? "Shuffle: On" : "Shuffle: Off"}
            >
              <Shuffle size={16} />
            </button>

            <div className="ytm-volume-container">
              <button className="ytm-extra-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                className="ytm-volume-slider"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
              />
            </div>

            {/* Expand Player */}
            <button
              className="ytm-extra-btn"
              onClick={() => setIsPlayerExpanded(true)}
              title="Expand Player"
              style={{ opacity: 0.7 }}
            >
              <ChevronUp size={16} />
            </button>

            {/* Close/Close Player */}
            <button
              className="ytm-extra-btn"
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setIsPlaying(false);
                setActiveAudioTrack(null);
              }}
              title="Close Player"
              style={{ marginLeft: '8px', opacity: 0.7 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Expandable Full-Screen Overlay Player */}
      {isPlayerExpanded && activeAudioTrack && (
        <div className="ytm-expanded-overlay">
          <header className="ytm-expanded-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Music size={14} />
              <span>Now Playing</span>
            </div>
            <button
              className="ytm-extra-btn"
              onClick={() => setIsPlayerExpanded(false)}
              title="Minimize Player"
              style={{ opacity: 0.8, background: 'rgba(255,255,255,0.05)', padding: '6px' }}
            >
              <ChevronDown size={20} />
            </button>
          </header>

          <div className="ytm-expanded-body">
            {/* Left Column: Visualizer cover, titles, and slider controls */}
            <div className="ytm-expanded-left">
              <div className={`ytm-expanded-cover-wrapper ${isPlaying ? 'playing' : 'paused'}`}>
                <div className="ytm-expanded-cover-icon">
                  <Music size={64} />
                </div>
              </div>

              <div className="ytm-expanded-meta">
                <span className="ytm-expanded-title" title={activeAudioTrack.title || activeAudioTrack.originalName}>
                  {activeAudioTrack.title || activeAudioTrack.originalName}
                </span>
                <span className="ytm-expanded-artist">
                  {activeAudioTrack.artist ? `${activeAudioTrack.artist} • ` : ''}{formatBytes(activeAudioTrack.size)} • G00J Archives
                </span>
              </div>

              <div className="ytm-expanded-controls-box">
                {/* Seek Bar */}
                <div className="ytm-progress-bar-wrapper">
                  <span className="ytm-time-text">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    className="ytm-progress-slider"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                  />
                  <span className="ytm-time-text">{formatTime(duration)}</span>
                </div>

                {/* Core Controls */}
                <div className="ytm-controls" style={{ marginTop: '8px' }}>
                  <button
                    className={`ytm-extra-btn ${isShuffled ? 'active' : ''}`}
                    onClick={() => setIsShuffled(!isShuffled)}
                    title="Shuffle"
                    style={{ marginRight: '16px' }}
                  >
                    <Shuffle size={18} />
                  </button>

                  <button className="ytm-control-btn" onClick={playPrev} title="Previous Track" style={{ padding: '10px' }}>
                    <SkipBack size={20} fill="currentColor" />
                  </button>

                  <button className="ytm-control-btn play-pause" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"} style={{ width: '48px', height: '48px' }}>
                    {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" style={{ marginLeft: '4px' }} />}
                  </button>

                  <button className="ytm-control-btn" onClick={playNext} title="Next Track" style={{ padding: '10px' }}>
                    <SkipForward size={20} fill="currentColor" />
                  </button>

                  <button
                    className={`ytm-extra-btn ${isLooping ? 'active' : ''}`}
                    onClick={() => setIsLooping(!isLooping)}
                    title="Repeat"
                    style={{ marginLeft: '16px' }}
                  >
                    <Repeat size={18} />
                  </button>
                </div>

                {/* Volume Control */}
                <div className="ytm-volume-container" style={{ marginTop: '16px', gap: '12px' }}>
                  <button className="ytm-extra-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input
                    type="range"
                    className="ytm-volume-slider"
                    style={{ width: '150px' }}
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Tab Switching (Up Next vs Lyrics) */}
            <div className="ytm-expanded-right">
              <div className="ytm-tabs-header">
                <button
                  className={`ytm-tab-btn ${activePlayerTab === 'queue' ? 'active' : ''}`}
                  onClick={() => setActivePlayerTab('queue')}
                >
                  Up Next
                </button>
                <button
                  className={`ytm-tab-btn ${activePlayerTab === 'lyrics' ? 'active' : ''}`}
                  onClick={() => setActivePlayerTab('lyrics')}
                >
                  Lyrics
                </button>
              </div>

              <div className="ytm-tab-content">
                {activePlayerTab === 'queue' ? (
                  <div className="ytm-queue-list">
                    {audioQueue.map((track, idx) => {
                      const isActive = track.id === activeAudioTrack.id;
                      return (
                        <div
                          key={track.id}
                          className={`ytm-queue-item ${isActive ? 'active' : ''}`}
                          onClick={() => playTrack(track)}
                        >
                          <div className="ytm-queue-track-meta">
                            <span className={`ytm-queue-track-title ${isActive ? 'active' : ''}`} title={track.originalName}>
                              {idx + 1}. {track.originalName}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left' }}>
                              {formatBytes(track.size)}
                            </span>
                          </div>
                          {isActive && (
                            <div className={`ytm-equalizer ${isPlaying ? '' : 'paused'}`}>
                              <div className="ytm-equalizer-bar"></div>
                              <div className="ytm-equalizer-bar"></div>
                              <div className="ytm-equalizer-bar"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ytm-lyrics-container">
                    {loadingLyrics ? (
                      <div className="ytm-lyrics-box searching">
                        <RefreshCw className="spin" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px auto' }} size={24} />
                        <span>Searching for lyrics on LRCLIB...</span>
                      </div>
                    ) : (
                      <div className="ytm-lyrics-box">
                        {lyricsText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
