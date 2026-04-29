







"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import Picker from "emoji-picker-react";
import { 
    SendHorizontal, Paperclip, Mic, StopCircle, Play, Pause, 
    Trash2, ArrowLeft, Settings, Smile, X, Download,
    Check, CheckCheck 
} from "lucide-react";

// ------------------------------------------------------------------
// --- 1. Funciones Auxiliares ---
// ------------------------------------------------------------------

const formatTime = (time) => {
  if (!isFinite(time) || isNaN(time)) return "00:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const getMediaURLFromBase64 = (base64Data, fileType) => {
  if (!base64Data || typeof base64Data !== 'string') return "";
  const type = fileType || "application/octet-stream";
  try {
    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return URL.createObjectURL(new Blob([ab], { type }));
  } catch (e) {
    console.error(e);
    return "";
  }
};

// ID constante
const generateUserId = () => "user-" + Math.floor(Math.random() * 9999);

// ------------------------------------------------------------------
// --- 2. Componentes UI ---
// ------------------------------------------------------------------

function MediaViewer({ fileUrl, fileType, fileName, onClose }) {
    if (!fileUrl) return null;
    const isImage = fileType?.startsWith('image/');
    const isVideo = fileType?.startsWith('video/');
    
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName || 'archivo';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-10">
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20"><X /></button>
                <button onClick={handleDownload} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20"><Download /></button>
            </div>
            <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden">
                {isImage && <img src={fileUrl} alt={fileName} className="max-h-[85vh] object-contain rounded shadow-lg" />}
                {isVideo && <video src={fileUrl} controls autoPlay className="max-h-[85vh] object-contain rounded shadow-lg" />}
                {!isImage && !isVideo && (
                    <div className="text-white p-6 bg-gray-800 rounded text-center">
                        <p className="mb-2">Archivo: {fileName}</p>
                        <button onClick={handleDownload} className="mt-4 px-4 py-2 bg-green-600 rounded text-white">Descargar</button>
                    </div>
                )}
            </div>
        </div>
    );
}

const AudioMessagePlayer = ({ audioURL, duration, isMe }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration || 0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onMeta = () => setAudioDuration(audio.duration);
        const onTime = () => setCurrentTime(audio.currentTime);
        const onEnd = () => { setIsPlaying(false); setCurrentTime(0); };
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnd);
        return () => {
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('ended', onEnd);
        };
    }, [audioURL]);

    const togglePlay = () => {
        if (audioRef.current) {
            isPlaying ? audioRef.current.pause() : audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div className="flex items-center gap-2 min-w-[200px]">
             <button onClick={togglePlay} className="text-gray-500 dark:text-gray-300">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
             </button>
             <div className="flex-1 flex flex-col">
                <input 
                    type="range" min="0" max={audioDuration || 1} value={currentTime} 
                    onChange={(e) => { audioRef.current.currentTime = e.target.value; setCurrentTime(e.target.value); }}
                    className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <span className="text-[10px] text-gray-500 dark:text-gray-300 mt-1 font-mono">
                    {formatTime(currentTime)} / {formatTime(audioDuration)}
                </span>
             </div>
             <audio ref={audioRef} src={audioURL} className="hidden" />
        </div>
    );
};

const FileMessageRenderer = ({ msg, isMe, onMediaClick }) => {
    const fileUrl = msg.mediaUrl;
    const isImage = msg.type === "image";
    const isVideo = msg.type === "video";
    
    if (isImage || isVideo) {
        return (
            <div className="cursor-pointer mt-1 mb-1 relative group" onClick={() => onMediaClick(msg)}>
                {isImage && <img src={fileUrl} alt="file" className="max-h-64 rounded-lg object-cover border border-gray-200 dark:border-transparent" />}
                {isVideo && (
                    <div className="relative">
                        <video src={fileUrl} className="max-h-64 rounded-lg object-cover bg-black" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg group-hover:bg-black/20 transition-colors">
                            <Play className="text-white w-12 h-12 opacity-80" />
                        </div>
                    </div>
                )}
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 p-3 bg-black/5 dark:bg-white/10 rounded-md border border-black/5 dark:border-transparent">
            <Paperclip className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            <div className="flex flex-col overflow-hidden">
                <a href={fileUrl} download={msg.fileName} className="text-sm font-medium truncate max-w-[150px] hover:underline">
                    {msg.fileName}
                </a>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{msg.fileType.split('/')[1]}</span>
            </div>
        </div>
    );
};

function MessageBubble({ msg, USER_ID, onMediaClick }) {
    const isMe = msg.from === USER_ID;
    
    // Lógica del Visto: Si es mio, mostrar checks
    // Doble Check Gris (Enviado/Recibido) -> Doble Check Azul (Visto)
    const SeenIcon = isMe ? CheckCheck : null; 
    const iconColor = isMe ? (msg.seen ? "text-blue-500" : "text-gray-400 dark:text-gray-500") : "";

    return (
        <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 px-2`}>
            <div className={`max-w-[85%] md:max-w-[65%] p-2 rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative break-words 
                ${isMe ? "bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none" : "bg-white dark:bg-[#202c33] rounded-tl-none"}`}>
                
                {!isMe && !msg.private && (
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1 cursor-pointer">{msg.from}</p>
                )}
                
                <div className={`${(msg.type === 'text' && msg.content.length < 50) ? 'pb-2 pr-16' : 'pb-4'} min-w-[80px]`}>
                    {msg.type === "text" && <p className="text-[15px] leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{msg.content}</p>}
                    {msg.type === "audio" && <AudioMessagePlayer audioURL={msg.mediaUrl} duration={msg.duration} isMe={isMe} />}
                    {(msg.type === "image" || msg.type === "file" || msg.type === "video") && <FileMessageRenderer msg={msg} isMe={isMe} onMediaClick={onMediaClick} />}
                </div>

                <div className="absolute bottom-1 right-1.5 flex items-center gap-1 select-none">
                    <span className="text-[10px] text-gray-500 dark:text-gray-300/90">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                    </span>
                    {isMe && SeenIcon && <SeenIcon className={`w-3.5 h-3.5 ${iconColor}`} />}
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
// --- 3. Componentes de Estructura (Sidebar, Chat, Layout) ---
// ------------------------------------------------------------------

function ChatSidebar({ 
    darkMode, selectedUser, activeUsers, publicMessagesCount, 
    privateChats, onSelectUser, setDarkMode, USER_ID, mobileView,
    lastPublicMsg
}) {
    // Clases CSS ajustadas para Responsive:
    // - Mobile List View: flex w-full
    // - Mobile Chat View: hidden
    // - Desktop: flex md:w-[400px] (siempre visible en desktop)
    const sidebarClass = `
        flex-col h-full border-r dark:border-gray-700 bg-white dark:bg-[#111b21] 
        transition-all duration-300
        md:flex md:w-[400px] md:min-w-[350px]
        ${mobileView === 'chat' ? 'hidden' : 'flex w-full'}
    `;

    return (
        <div className={sidebarClass}>
            {/* Header Sidebar */}
            <div className="h-[60px] px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between shrink-0 border-b dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                        <span className="font-bold text-gray-600 dark:text-gray-300 text-xs">YO</span>
                    </div>
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{USER_ID}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-300">
                        {darkMode ? '☀️' : '🌙'}
                    </button>
                </div>
            </div>
            
            {/* Lista de Chats */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Chat Público */}
                <div onClick={() => onSelectUser(null)} className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors border-b border-gray-100 dark:border-gray-800 ${selectedUser === null ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : ""}`}>
                    <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xl shadow-sm">🌍</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="font-medium text-gray-900 dark:text-white text-[17px]">Chat Público</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {lastPublicMsg ? lastPublicMsg : "Haz clic para unirte al grupo"}
                        </p>
                    </div>
                </div>

                <div className="px-4 py-3 text-[#008069] dark:text-[#00a884] text-xs font-bold uppercase tracking-wider">
                    Usuarios Conectados ({activeUsers.length})
                </div>

                {activeUsers.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm italic">
                        Esperando a que otros usuarios se conecten...
                    </div>
                )}

                {activeUsers.map(u => {
                    const msgs = privateChats[u] || [];
                    const lastMsg = msgs[msgs.length - 1];
                    const unseen = msgs.filter(m => m.from === u && !m.seen).length;
                    
                    return (
                        <div key={u} onClick={() => onSelectUser(u)} className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors border-b border-gray-100 dark:border-gray-800 ${selectedUser === u ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : ""}`}>
                            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200 text-xl">👤</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-gray-900 dark:text-white text-[17px] truncate">{u}</span>
                                    {lastMsg && <span className={`text-xs ${unseen ? 'text-[#25d366] font-bold' : 'text-gray-500 dark:text-gray-400'}`}>{new Date(lastMsg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[85%] flex items-center gap-1">
                                        {lastMsg?.from === USER_ID && (
                                            <CheckCheck className={`w-3.5 h-3.5 ${lastMsg.seen ? 'text-blue-500' : 'text-gray-400'}`} />
                                        )}
                                        {lastMsg ? (lastMsg.type === 'text' ? lastMsg.content : (lastMsg.type === 'audio' ? '🎤 Audio' : '📎 Archivo')) : '¡Saluda! 👋'}
                                    </p>
                                    {unseen > 0 && (
                                        <span className="bg-[#25d366] text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 shadow-sm">
                                            {unseen}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function ChatPage() {
    // Usamos useState con initializer para que el ID sea estable entre renders
    const [userId] = useState(() => generateUserId()); 
    const [isClient, setIsClient] = useState(false);
    
    // Estados de Datos
    const [publicMessages, setPublicMessages] = useState([]);
    const [privateChats, setPrivateChats] = useState({}); 
    const [activeUsers, setActiveUsers] = useState([]);
    
    // Estados de UI
    const [selectedUser, setSelectedUser] = useState(null); 
    const [mobileView, setMobileView] = useState('list'); 
    const [text, setText] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    // Estados Media
    const [isRecording, setIsRecording] = useState(false);
    const [audioFile, setAudioFile] = useState(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [mediaViewerData, setMediaViewerData] = useState(null);

    // Refs
    const socketRef = useRef(null);
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    useEffect(() => { setIsClient(true); }, []);

    // --- 1. CONEXIÓN SOCKET ---
    useEffect(() => {
        if (!userId) return; // Seguridad
        
        socketRef.current = io("http://localhost:3001", { query: { username: userId } });

        socketRef.current.on("active-users", (users) => {
            const others = users.filter(u => u !== userId);
            setActiveUsers(others);
        });

        socketRef.current.on("public-message", (msg) => {
            setPublicMessages(prev => [...prev, { ...msg, private: false, seen: true }]);
        });

        socketRef.current.on("private-message", (msg) => {
            setPrivateChats(prev => {
                const otherUser = msg.from;
                const history = prev[otherUser] || [];
                // Si estoy viendo el chat de quien me escribe, emitimos 'mark-seen'
                // Nota: No tenemos acceso directo a 'selectedUser' (stale closure) aquí fácilmente sin ref,
                // así que confiamos en el click del usuario o manejamos lógica más compleja.
                // Por ahora, el usuario marcará visto al hacer click/entrar al chat.
                return { ...prev, [otherUser]: [...history, { ...msg, private: true }] };
            });
        });

        socketRef.current.on("send-file", (msg) => {
            const url = getMediaURLFromBase64(msg.file, msg.fileType);
            setPublicMessages(prev => [...prev, { ...msg, mediaUrl: url, private: false, seen: true }]);
        });

        socketRef.current.on("private-file", (msg) => {
            const url = getMediaURLFromBase64(msg.file, msg.fileType);
            setPrivateChats(prev => {
                const otherUser = msg.from;
                const history = prev[otherUser] || [];
                return { ...prev, [otherUser]: [...history, { ...msg, mediaUrl: url, private: true }] };
            });
        });

        // Evento "VISTO": Cuando el otro usuario lee mis mensajes
        socketRef.current.on("messages-seen", ({ byUser }) => {
            setPrivateChats(prev => {
                if (!prev[byUser]) return prev;
                // Actualizamos MIS mensajes enviados a 'byUser' a seen: true
                const updatedChat = prev[byUser].map(m => 
                    (m.from === userId) ? { ...m, seen: true } : m
                );
                return { ...prev, [byUser]: updatedChat };
            });
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [userId]);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [publicMessages, privateChats, selectedUser, mobileView]);


    // --- 2. MANEJADORES ---

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setMobileView('chat'); // Cambiar a vista de chat en móvil
        
        // Lógica de marcar como visto al entrar
        if (user && privateChats[user]) {
            // 1. Avisar al servidor para que avise al remitente
            socketRef.current.emit('mark-seen', { from: userId, to: user });
            
            // 2. Actualizar mi UI local (quitar contador de no leídos)
            setPrivateChats(prev => ({
                ...prev,
                [user]: prev[user].map(m => m.from === user ? { ...m, seen: true } : m)
            }));
        }
    };

    const handleBack = () => {
        setMobileView('list'); // Volver a la lista en móvil
    };

    const sendMessage = (content, type = "text", fileData = null) => {
        const timestamp = Date.now();
        const msgPayload = { 
            from: userId, 
            content: content || "", 
            type, 
            timestamp, 
            seen: false,
            ...fileData 
        };

        if (selectedUser) {
            // Privado
            setPrivateChats(prev => {
                const history = prev[selectedUser] || [];
                return { ...prev, [selectedUser]: [...history, { ...msgPayload, private: true, to: selectedUser }] };
            });
            
            if (type === "text") {
                socketRef.current.emit("private-message", { content, to: selectedUser });
            } else {
                socketRef.current.emit("private-file", { 
                    file: fileData.fileRaw, fileName: fileData.fileName, fileType: fileData.fileType, duration: fileData.duration, to: selectedUser 
                });
            }
        } else {
            // Público
            setPublicMessages(prev => [...prev, { ...msgPayload, private: false, seen: true }]);
            
            if (type === "text") {
                socketRef.current.emit("public-message", content);
            } else {
                socketRef.current.emit("send-file", { 
                    file: fileData.fileRaw, fileName: fileData.fileName, fileType: fileData.fileType, duration: fileData.duration 
                });
            }
        }
    };

    const handleSendText = () => {
        if (!text.trim()) return;
        sendMessage(text, "text");
        setText("");
        setShowEmoji(false);
    };

    // --- AUDIO & FILE LOGIC ---
    const startRec = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = e => chunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    setAudioFile({ url, base64: reader.result.split(',')[1] });
                };
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (e) { alert("Error Micrófono"); }
    };

    const stopRec = () => {
        if (isRecording && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setAudioDuration(5); 
        }
    };

    const sendAudio = () => {
        if (audioFile) {
            sendMessage("", "audio", { 
                mediaUrl: audioFile.url, fileRaw: audioFile.base64, fileType: "audio/webm", fileName: "audio.webm", duration: audioDuration 
            });
            setAudioFile(null);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target.result.split(',')[1];
            const url = URL.createObjectURL(file);
            const type = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'file';
            sendMessage("", type, { mediaUrl: url, fileRaw: base64, fileName: file.name, fileType: file.type });
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    if (!isClient) return <div className="flex items-center justify-center h-screen bg-[#f0f2f5] dark:bg-[#111b21] text-gray-500">Cargando WhatsApp Clone...</div>;

    const currentMessages = selectedUser ? (privateChats[selectedUser] || []) : publicMessages;

    return (
        <div className={`flex h-screen overflow-hidden ${darkMode ? "dark bg-[#0b141a]" : "bg-gray-100"}`}>
            
            {/* Sidebar: Oculto en móvil si hay chat abierto (mobileView === 'chat') */}
            <ChatSidebar 
                darkMode={darkMode} selectedUser={selectedUser} 
                activeUsers={activeUsers} privateChats={privateChats}
                onSelectUser={handleSelectUser} setDarkMode={setDarkMode} 
                USER_ID={userId} mobileView={mobileView}
                lastPublicMsg={publicMessages[publicMessages.length-1]?.content}
                publicMessagesCount={publicMessages.length}
            />

            {/* Chat Container: Oculto en móvil si NO hay chat abierto ('list') */}
            {/* En Desktop siempre se muestra (md:flex) */}
            <div className={`
                flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a] relative 
                ${mobileView === 'chat' ? 'flex absolute inset-0 z-50' : 'hidden md:flex'}
            `}>
                <div className="absolute inset-0 opacity-40 pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>

                {/* Header Chat */}
                <div className="h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] flex items-center px-4 justify-between shadow-sm z-10 border-b dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <button onClick={handleBack} className="md:hidden p-2 -ml-2 text-gray-600 dark:text-white hover:bg-black/5 rounded-full"><ArrowLeft /></button>
                        <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white text-lg cursor-pointer">
                            {selectedUser ? '👤' : '🌍'}
                        </div>
                        <div className="flex flex-col justify-center ml-1 cursor-pointer">
                            <p className="font-medium text-gray-900 dark:text-white leading-tight">{selectedUser || "Chat Público"}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{selectedUser ? "en línea" : "Toca para info del grupo"}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 text-[#00a884] dark:text-[#00a884] mr-2">
                        <Settings className="cursor-pointer w-6 h-6" />
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:px-8 md:px-12 custom-scrollbar relative z-0">
                    {currentMessages.map((msg, i) => (
                        <MessageBubble 
                            key={i} msg={msg} USER_ID={userId} 
                            onMediaClick={(m) => setMediaViewerData({ fileUrl: m.mediaUrl, fileType: m.fileType, fileName: m.fileName })}
                        />
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Input Area */}
                <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2 flex items-end gap-2 z-10 select-none">
                    {showEmoji && (
                        <div className="absolute bottom-20 left-4 z-50 shadow-2xl">
                            <Picker onEmojiClick={(e) => setText(prev => prev + e.emoji)} theme={darkMode ? 'dark' : 'light'} />
                        </div>
                    )}

                    {!audioFile && !isRecording && (
                        <>
                            <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center px-2 py-1.5 shadow-sm">
                                <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><Smile /></button>
                                <input 
                                    className="flex-1 bg-transparent px-2 py-1 outline-none dark:text-white max-h-[100px] overflow-y-auto" 
                                    placeholder="Escribe un mensaje" 
                                    value={text} 
                                    onChange={e => setText(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && handleSendText()}
                                />
                                <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full rotate-45"><Paperclip className="w-5 h-5" /></button>
                                <input type="file" hidden ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*,audio/*,application/*" />
                            </div>
                            <button 
                                onClick={text.trim() ? handleSendText : startRec} 
                                className={`p-3 rounded-full text-white shadow-md transition-transform active:scale-95 ${text.trim() ? 'bg-[#008069] hover:bg-[#006c59]' : 'bg-[#008069] hover:bg-[#006c59]'}`}
                            >
                                {text.trim() ? <SendHorizontal className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                        </>
                    )}

                    {isRecording && (
                        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center p-3 gap-3 animate-pulse shadow-sm">
                            <Mic className="text-red-500 animate-bounce w-5 h-5" />
                            <span className="flex-1 text-gray-500 dark:text-gray-300 font-mono">Grabando audio...</span>
                            <button onClick={() => {stopRec(); setIsRecording(false); setAudioFile(null);}} className="text-red-500 text-sm font-medium hover:underline">Cancelar</button>
                            <button onClick={stopRec} className="text-green-500"><StopCircle className="w-6 h-6" /></button>
                        </div>
                    )}

                    {audioFile && (
                        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center p-2 gap-3 shadow-sm">
                            <button onClick={() => setAudioFile(null)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"><Trash2 className="w-5 h-5" /></button>
                            <div className="flex-1 flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Audio</span>
                                <div className="flex-1 h-1 bg-green-500/30 rounded overflow-hidden">
                                    <div className="h-full bg-green-500 w-full"></div>
                                </div>
                            </div>
                            <button onClick={sendAudio} className="p-3 bg-[#008069] rounded-full text-white shadow-md hover:bg-[#006c59]"><SendHorizontal className="w-5 h-5" /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Viewer */}
            {mediaViewerData && (
                <MediaViewer 
                    fileUrl={mediaViewerData.fileUrl} 
                    fileType={mediaViewerData.fileType} 
                    fileName={mediaViewerData.fileName} 
                    onClose={() => setMediaViewerData(null)} 
                />
            )}
        </div>
    );
}


































































// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";
// import Picker from "emoji-picker-react";
// import { SendHorizontal, Paperclip, Mic, StopCircle, Volume2, Settings, Play, Pause, Trash2 } from "lucide-react";

// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// // Helper para convertir Base64 a URL
// const getAudioURLFromBase64 = (base64Data, fileType) => {
//   if (!base64Data || typeof base64Data !== 'string') return "";
//   const type = fileType || "audio/webm";
//   try {
//     const byteString = atob(base64Data);
//     const ab = new ArrayBuffer(byteString.length);
//     const ia = new Uint8Array(ab);
//     for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
//     return URL.createObjectURL(new Blob([ab], { type }));
//   } catch (e) {
//     console.error(e);
//     return "";
//   }
// };

// export default function ChatPage() {
//   // --- ESTADOS DEL CHAT ---
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [darkMode, setDarkMode] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   // --- ESTADOS DE AUDIO ---
//   const [audioFile, setAudioFile] = useState(null); 
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isRecording, setIsRecording] = useState(false);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [recordedDuration, setRecordedDuration] = useState(0);
//   const [recordTime, setRecordTime] = useState(0);
  
//   // Configuración de Micro
//   const [audioDevices, setAudioDevices] = useState([]);
//   const [selectedDeviceId, setSelectedDeviceId] = useState("");
//   const [showMicSettings, setShowMicSettings] = useState(false);

//   // --- REFS ---
//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);
//   const socketRef = useRef(null);
  
//   // Refs de Audio
//   const audioRef = useRef(null);
//   const mediaRecorderRef = useRef(null);
//   const audioChunksRef = useRef([]);
//   const recordTimeRef = useRef(0);

//   // -------------------------------
//   // 1. Inicializar Socket y Permisos
//   // -------------------------------
//   useEffect(() => {
//     socketRef.current = io("http://localhost:4000", { query: { userId: USER_ID } });

//     socketRef.current.on("receive-message", (msg) => {
//       if (msg.from === USER_ID) return;

//       const newMsg = { ...msg };
//       if (newMsg.fileType?.startsWith("audio/") && newMsg.file) {
//         newMsg.audioURL = getAudioURLFromBase64(newMsg.file, newMsg.fileType);
//         newMsg.type = "audio";
//       }
      
//       if (newMsg.private) {
//         const otherUser = newMsg.from === USER_ID ? newMsg.to : newMsg.from;
//         setPrivateChats((prev) => {
//           const msgs = prev[otherUser] || [];
//           return { ...prev, [otherUser]: [...msgs, { ...newMsg }] };
//         });
//       } else {
//         setPublicMessages((prev) => [...prev, { ...newMsg }]);
//       }
//     });

//     socketRef.current.on("active-users", (users) => setActiveUsers(users.filter((u) => u !== USER_ID)));

//     const getMicrophones = async () => {
//         try {
//             await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
//             const devices = await navigator.mediaDevices.enumerateDevices();
//             const inputs = devices.filter(d => d.kind === 'audioinput');
//             setAudioDevices(inputs);
//             if(inputs.length > 0) {
//                 const defaultDevice = inputs.find(d => d.deviceId === 'default') || inputs[0];
//                 setSelectedDeviceId(defaultDevice.deviceId);
//             }
//         } catch(e) { console.error("Error permisos micro:", e); }
//     };
//     getMicrophones();

//     return () => socketRef.current && socketRef.current.disconnect();
//   }, []);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser, audioFile, isRecording]);

//   // -------------------------------
//   // 2. Lógica de Audio
//   // -------------------------------

//   const formatTime = (time) => {
//     if (!isFinite(time) || isNaN(time)) return "00:00";
//     const minutes = Math.floor(time / 60);
//     const seconds = Math.floor(time % 60);
//     return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
//   };

//   useEffect(() => {
//     return () => {
//       if (audioFile) URL.revokeObjectURL(audioFile);
//     };
//   }, [audioFile]);

//   useEffect(() => {
//     let interval;
//     if (isRecording) {
//       setRecordTime(0);
//       recordTimeRef.current = 0;
//       interval = setInterval(() => {
//         setRecordTime((prev) => {
//           const newVal = prev + 1;
//           recordTimeRef.current = newVal;
//           return newVal;
//         });
//       }, 1000);
//     }
//     return () => { if (interval) clearInterval(interval); };
//   }, [isRecording]);

//   const togglePlay = () => {
//     if (audioRef.current) {
//       if (isPlaying) {
//         audioRef.current.pause();
//       } else {
//         audioRef.current.play();
//       }
//       setIsPlaying(!isPlaying);
//     }
//   };

//   const getSupportedMimeType = () => {
//     const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
//     return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
//   };

//   const startRecording = async () => {
//     try {
//       const constraints = { 
//           audio: {
//             deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
//             echoCancellation: true,
//             noiseSuppression: true,
//           } 
//       };

//       const stream = await navigator.mediaDevices.getUserMedia(constraints);
//       const mimeType = getSupportedMimeType();
//       const options = mimeType ? { mimeType } : {};

//       const mediaRecorder = new MediaRecorder(stream, options);
//       mediaRecorderRef.current = mediaRecorder;
//       audioChunksRef.current = [];

//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data.size > 0) audioChunksRef.current.push(event.data);
//       };

//       mediaRecorder.onstop = () => {
//         const finalMimeType = mediaRecorder.mimeType || options.mimeType || 'audio/webm';
//         const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
//         if (audioFile) URL.revokeObjectURL(audioFile);
//         const audioURL = URL.createObjectURL(audioBlob);
//         setAudioFile(audioURL);
//         setIsPlaying(false);
//         setCurrentTime(0);
//         setRecordedDuration(recordTimeRef.current);
//         mediaRecorder.stream.getTracks().forEach(track => track.stop());
//       };

//       mediaRecorder.start(1000); 
//       setIsRecording(true);
//       setAudioFile(null); 
//     } catch (error) {
//       console.error("Error al iniciar la grabación:", error);
//       alert("No se pudo acceder al micrófono.");
//     }
//   };

//   const stopRecording = () => {
//     if (mediaRecorderRef.current && isRecording && mediaRecorderRef.current.state !== 'inactive') {
//       mediaRecorderRef.current.stop();
//       setIsRecording(false);
//     }
//   };

//   const cancelRecording = () => {
//       setAudioFile(null);
//       setIsRecording(false);
//       setRecordTime(0);
//       setRecordedDuration(0);
//       audioChunksRef.current = [];
//       if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
//           mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
//       }
//   };

//   const handleTimeUpdate = () => {
//     if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
//   };

//   const handleProgressChange = (event) => {
//     if (audioRef.current) {
//       const newTime = parseFloat(event.target.value);
//       audioRef.current.currentTime = newTime;
//       setCurrentTime(newTime);
//     }
//   };

//   // -------------------------------
//   // 3. Lógica de Envío
//   // -------------------------------
  
//   const sendAudioMessage = () => {
//     if (!audioChunksRef.current.length) return;

//     const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
//     const blob = new Blob(audioChunksRef.current, { type: mimeType });

//     const reader = new FileReader();
//     reader.readAsDataURL(blob);
//     reader.onloadend = () => {
//         const base64String = reader.result;
//         const base64Pure = base64String.split(',')[1];

//         const payload = { 
//             file: base64Pure, 
//             fileName: `audio-${Date.now()}.webm`, 
//             fileType: mimeType,
//             // --- SOLUCIÓN DE DURACIÓN: Enviamos la duración calculada ---
//             duration: recordedDuration 
//         };
        
//         const persistentAudioUrl = getAudioURLFromBase64(base64Pure, mimeType);

//         const localMsg = { 
//             ...payload, 
//             type: "audio", 
//             from: USER_ID, 
//             timestamp: Date.now(), 
//             audioURL: persistentAudioUrl, 
//             seen: false 
//         };

//         if (selectedUser) {
//             socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//             setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//         } else {
//             socketRef.current.emit("send-file", payload);
//             setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//         }

//         cancelRecording();
//     };
//   };

//   const sendText = () => {
//     if (!text.trim()) return;
//     const msg = { type: "text", content: text };
//     const localMsg = { ...msg, from: USER_ID, timestamp: Date.now() };

//     if (selectedUser) {
//       socketRef.current.emit("private-message", { to: selectedUser, message: text });
//       setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//     } else {
//       socketRef.current.emit("send-message", msg);
//       setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//     }
//     setText("");
//     setShowEmojiPicker(false);
//   };

//   const sendFileFromInput = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onloadend = () => {
//         const isAudio = file.type.startsWith("audio/");
//         const base64Pure = reader.result.split(',')[1];
//         const payload = { file: base64Pure, fileName: file.name, fileType: file.type };
//         const localMsg = { ...payload, type: isAudio ? "audio" : "file", from: USER_ID, timestamp: Date.now(), audioURL: isAudio ? getAudioURLFromBase64(payload.file, payload.fileType) : undefined };

//         if (selectedUser) {
//             socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//             setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//         } else {
//             socketRef.current.emit("send-file", payload);
//             setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//         }
//     };
//     reader.readAsDataURL(file);
//     e.target.value = null;
//   };

//   // -------------------------------
//   // Render
//   // -------------------------------
//   const onEmojiClick = (emojiObject) => setText((prev) => prev + emojiObject.emoji);
//   const visibleMessages = selectedUser === null ? publicMessages : privateChats[selectedUser] || [];

//   useEffect(() => {
//     if (selectedUser && socketRef.current) {
//       socketRef.current.emit("message-seen", { to: selectedUser });
//       setPrivateChats((prev) => {
//         const msgs = prev[selectedUser]?.map((m) => m.from !== USER_ID ? { ...m, seen: true } : m);
//         return { ...prev, [selectedUser]: msgs };
//       });
//     }
//   }, [selectedUser]);

//   return (
//     <div className={`${darkMode ? "dark" : ""} flex h-screen overflow-hidden`}>
      
//       <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 shadow-lg ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:flex flex-col`}>
//         <h2 className="px-6 py-5 font-bold text-xl">Usuarios</h2>
//         <button onClick={() => setSelectedUser(null)} className={`w-full text-left p-4 my-1 rounded-xl ${selectedUser === null ? "bg-green-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>🌍 Chat Público</button>
//         <ul className="flex-1 overflow-y-auto">
//             {activeUsers.map(u => <li key={u} onClick={() => setSelectedUser(u)} className={`p-4 cursor-pointer rounded-xl ${selectedUser === u ? "bg-green-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>👤 {u}</li>)}
//         </ul>
//         <div className="p-4 border-t flex justify-between items-center">
//             <span className="dark:text-white">Modo oscuro</span>
//             <input type="checkbox" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
//         </div>
//       </div>

//       <div className="flex-1 flex flex-col md:ml-64 bg-gray-50 dark:bg-gray-800 transition-colors">
//         <div className="bg-green-500 px-6 py-4 flex justify-between text-white shadow-md">
//           <h1 className="font-semibold">{selectedUser ? `Chat con ${selectedUser}` : "Chat Público"}</h1>
//           <span className="text-xs opacity-75">ID: {USER_ID}</span>
//         </div>

//         <div className="flex-1 overflow-y-auto p-4 space-y-3">
//             {visibleMessages.map((msg, i) => {
//                 const isMe = msg.from === USER_ID;
//                 return (
//                     <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
//                         <div className={`max-w-[75%] p-3 rounded-2xl shadow-md break-words ${isMe ? "bg-green-500 text-white rounded-br-none" : "bg-gray-200 text-gray-900 rounded-bl-none"}`}>
//                             {msg.type === "text" && <p>{msg.content}</p>}
//                             {(msg.type === "audio" || msg.type === "file") && (
//                                 <div className="mt-1">
//                                     {msg.type === "audio" && msg.audioURL ? (
//                                         <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg min-w-[250px]">
//                                             <Volume2 className="h-5 w-5 flex-shrink-0" />
//                                             <audio controls src={msg.audioURL} className="flex-1 h-8" />
//                                             {/* --- SOLUCIÓN VISUAL: Mostramos la duración aquí si el navegador falla --- */}
//                                             {msg.duration > 0 && (
//                                               <span className="text-xs font-mono opacity-60 whitespace-nowrap">
//                                                 {formatTime(msg.duration)}
//                                               </span>
//                                             )}
//                                         </div>
//                                     ) : msg.fileType?.startsWith("image") ? (
//                                         <img src={`data:${msg.fileType};base64,${msg.file}`} alt="img" className="rounded-lg max-h-48" />
//                                     ) : (
//                                         <a href={`data:${msg.fileType};base64,${msg.file}`} download={msg.fileName} className="underline flex items-center gap-1 font-medium"><Paperclip className="h-4 w-4"/>{msg.fileName}</a>
//                                     )}
//                                 </div>
//                             )}
//                             <div className="text-right text-xs mt-1 opacity-70">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
//                         </div>
//                     </div>
//                 )
//             })}
//             <div ref={bottomRef}></div>
//         </div>

//         {showEmojiPicker && <div className="absolute bottom-20 right-4 z-50"><Picker onEmojiClick={onEmojiClick} /></div>}

//         <div className="p-3 bg-white dark:bg-gray-900 border-t dark:border-gray-700 shadow-lg">
            
//             {audioFile && (
//                 <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-bottom-2">
//                     <button onClick={cancelRecording} className="p-3 text-red-500 hover:bg-red-100 rounded-full transition-colors">
//                         <Trash2 className="w-5 h-5" />
//                     </button>

//                     <div className="flex-1 flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-2 rounded-full px-4">
//                         <button onClick={togglePlay} className="text-blue-500">
//                             {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
//                         </button>
                        
//                         <div className="flex-1 flex flex-col w-full">
//                             <input
//                                 type="range"
//                                 min="0"
//                                 max={recordedDuration || 0}
//                                 value={currentTime}
//                                 step="0.1"
//                                 onChange={handleProgressChange}
//                                 className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
//                             />
//                             <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
//                                 <span>{formatTime(currentTime)}</span>
//                                 <span>{formatTime(recordedDuration)}</span>
//                             </div>
//                         </div>

//                         <audio
//                             ref={audioRef}
//                             src={audioFile}
//                             onTimeUpdate={handleTimeUpdate}
//                             onEnded={() => setIsPlaying(false)}
//                             className="hidden"
//                         />
//                     </div>

//                     <button onClick={sendAudioMessage} className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg">
//                         <SendHorizontal className="w-5 h-5" />
//                     </button>
//                 </div>
//             )}

//             {!audioFile && isRecording && (
//                 <div className="flex items-center justify-between w-full px-2 animate-pulse">
//                      <div className="flex items-center gap-2 text-red-500 font-mono font-bold">
//                         <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
//                         Grabando: {formatTime(recordTime)}
//                      </div>
//                      <button onClick={stopRecording} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg">
//                         <StopCircle className="w-6 h-6" />
//                      </button>
//                 </div>
//             )}

//             {!audioFile && !isRecording && (
//                 <div className="flex items-center gap-2">
//                     <button onClick={() => fileInputRef.current.click()} className="p-2 rounded-full bg-yellow-400 hover:bg-yellow-300"><Paperclip className="h-5 w-5 text-black" /></button>
//                     <input type="file" hidden ref={fileInputRef} onChange={sendFileFromInput} />
                    
//                     <input 
//                         className="flex-1 rounded-full px-5 py-3 bg-gray-100 dark:bg-gray-700 dark:text-white border-none focus:ring-2 focus:ring-green-500 outline-none transition-all" 
//                         placeholder="Escribe un mensaje..." 
//                         value={text}
//                         onChange={(e) => setText(e.target.value)}
//                         onKeyDown={(e) => e.key === "Enter" && sendText()} 
//                     />
                    
//                     <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300">😃</button>

//                     <div className="relative">
//                         <button onClick={() => setShowMicSettings(!showMicSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
//                             <Settings className="h-5 w-5" />
//                         </button>
//                         {showMicSettings && (
//                              <div className="absolute bottom-14 right-0 w-48 bg-white dark:bg-gray-800 shadow-xl border rounded p-2 z-50">
//                                 <p className="text-xs font-bold text-gray-500 mb-1">Micrófono:</p>
//                                 <select 
//                                     className="w-full text-xs p-1 border rounded dark:bg-gray-700 dark:text-white"
//                                     value={selectedDeviceId}
//                                     onChange={(e) => { setSelectedDeviceId(e.target.value); setShowMicSettings(false); }}
//                                 >
//                                     {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Default"}</option>)}
//                                 </select>
//                              </div>
//                         )}
//                     </div>

//                     <button onClick={startRecording} className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md">
//                         <Mic className="h-5 w-5" />
//                     </button>
                    
//                     {text.trim() && (
//                         <button onClick={sendText} className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 shadow-md ml-1">
//                             <SendHorizontal className="h-5 w-5" />
//                         </button>
//                     )}
//                 </div>
//             )}
//         </div>
//       </div>
//     </div>
//   );
// }
































// // FUNCIONAL
// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";
// import Picker from "emoji-picker-react";
// import { SendHorizontal, Paperclip, Mic, StopCircle, Volume2, Settings, Play, Pause, Trash2 } from "lucide-react";
// // import AudioRecorder from '@/components/AudioRecorder' // <--- ELIMINAR O COMENTAR ESTO (Causa conflicto)

// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// // Helper para convertir Base64 a URL
// const getAudioURLFromBase64 = (base64Data, fileType) => {
//   if (!base64Data || typeof base64Data !== 'string') return "";
//   const type = fileType || "audio/webm";
//   try {
//     const byteString = atob(base64Data);
//     const ab = new ArrayBuffer(byteString.length);
//     const ia = new Uint8Array(ab);
//     for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
//     return URL.createObjectURL(new Blob([ab], { type }));
//   } catch (e) {
//     console.error(e);
//     return "";
//   }
// };

// export default function ChatPage() {
//   // --- ESTADOS DEL CHAT ---
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [darkMode, setDarkMode] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   // --- ESTADOS DE AUDIO ---
//   const [audioFile, setAudioFile] = useState(null); 
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isRecording, setIsRecording] = useState(false);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [recordedDuration, setRecordedDuration] = useState(0);
//   const [recordTime, setRecordTime] = useState(0);
  
//   // Configuración de Micro
//   const [audioDevices, setAudioDevices] = useState([]);
//   const [selectedDeviceId, setSelectedDeviceId] = useState("");
//   const [showMicSettings, setShowMicSettings] = useState(false);

//   // --- REFS ---
//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);
//   const socketRef = useRef(null);
  
//   // Refs de Audio
//   const audioRef = useRef(null);
//   const mediaRecorderRef = useRef(null);
//   const audioChunksRef = useRef([]);
//   const recordTimeRef = useRef(0);

//   // -------------------------------
//   // 1. Inicializar Socket y Permisos
//   // -------------------------------
//   useEffect(() => {
//     socketRef.current = io("http://localhost:4000", { query: { userId: USER_ID } });

//     socketRef.current.on("receive-message", (msg) => {
//       const newMsg = { ...msg };
//       if (newMsg.fileType?.startsWith("audio/") && newMsg.file) {
//         newMsg.audioURL = getAudioURLFromBase64(newMsg.file, newMsg.fileType);
//         newMsg.type = "audio";
//       }
      
//       if (newMsg.private) {
//         const otherUser = newMsg.from === USER_ID ? newMsg.to : newMsg.from;
//         setPrivateChats((prev) => {
//           const msgs = prev[otherUser] || [];
//           return { ...prev, [otherUser]: [...msgs, { ...newMsg }] };
//         });
//       } else {
//         setPublicMessages((prev) => [...prev, { ...newMsg }]);
//       }
//     });

//     socketRef.current.on("active-users", (users) => setActiveUsers(users.filter((u) => u !== USER_ID)));

//     // Cargar micrófonos
//     const getMicrophones = async () => {
//         try {
//             // Solicitar permiso primero para poder listar las etiquetas de los dispositivos
//             await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
//             const devices = await navigator.mediaDevices.enumerateDevices();
//             const inputs = devices.filter(d => d.kind === 'audioinput');
//             setAudioDevices(inputs);
//             // Seleccionar el "default" o el primero disponible
//             if(inputs.length > 0) {
//                 const defaultDevice = inputs.find(d => d.deviceId === 'default') || inputs[0];
//                 setSelectedDeviceId(defaultDevice.deviceId);
//             }
//         } catch(e) { console.error("Error permisos micro:", e); }
//     };
//     getMicrophones();

//     return () => socketRef.current && socketRef.current.disconnect();
//   }, []);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser, audioFile, isRecording]);

//   // -------------------------------
//   // 2. Lógica de Audio (CORREGIDA PARA CHROME)
//   // -------------------------------

//   const formatTime = (time) => {
//     if (!isFinite(time) || isNaN(time)) return "00:00";
//     const minutes = Math.floor(time / 60);
//     const seconds = Math.floor(time % 60);
//     return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
//   };

//   useEffect(() => {
//     return () => {
//       if (audioFile) URL.revokeObjectURL(audioFile);
//     };
//   }, [audioFile]);

//   useEffect(() => {
//     let interval;
//     if (isRecording) {
//       setRecordTime(0);
//       recordTimeRef.current = 0;
//       interval = setInterval(() => {
//         setRecordTime((prev) => {
//           const newVal = prev + 1;
//           recordTimeRef.current = newVal;
//           return newVal;
//         });
//       }, 1000);
//     }
//     return () => { if (interval) clearInterval(interval); };
//   }, [isRecording]);

//   const togglePlay = () => {
//     if (audioRef.current) {
//       if (isPlaying) {
//         audioRef.current.pause();
//       } else {
//         audioRef.current.play();
//       }
//       setIsPlaying(!isPlaying);
//     }
//   };

//   // --- FUNCIÓN CLAVE: Detectar MIME type soportado dinámicamente ---
//   const getSupportedMimeType = () => {
//     const types = [
//       "audio/webm;codecs=opus",
//       "audio/webm",
//       "audio/mp4",
//       "audio/ogg",
//       "audio/wav"
//     ];
//     return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
//   };

//   const startRecording = async () => {
//     try {
//       // Configuración más simple para Chrome (evita errores de OverconstrainedError)
//       const constraints = { 
//           audio: {
//             deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
//             echoCancellation: true,
//             noiseSuppression: true,
//             // autoGainControl: true // A veces causa problemas en Chrome Mac/Windows específicos
//           } 
//       };

//       const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
//       // 1. Detectar el mejor formato soportado por el navegador actual
//       const mimeType = getSupportedMimeType();
      
//       // 2. Opciones sin forzar bitrate (Chrome prefiere manejar esto automáticamente)
//       const options = mimeType ? { mimeType } : {};

//       const mediaRecorder = new MediaRecorder(stream, options);
//       mediaRecorderRef.current = mediaRecorder;
//       audioChunksRef.current = [];

//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data.size > 0) {
//           audioChunksRef.current.push(event.data);
//         }
//       };

//       mediaRecorder.onstop = () => {
//         // Crear Blob final usando el tipo que el navegador decidió usar
//         const finalMimeType = mediaRecorder.mimeType || options.mimeType || 'audio/webm';
//         const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        
//         if (audioFile) URL.revokeObjectURL(audioFile);
        
//         const audioURL = URL.createObjectURL(audioBlob);
//         setAudioFile(audioURL);
        
//         setIsPlaying(false);
//         setCurrentTime(0);
//         setRecordedDuration(recordTimeRef.current);

//         // Detener tracks para liberar el icono de "grabando" en la pestaña
//         mediaRecorder.stream.getTracks().forEach(track => track.stop());
//       };

//       mediaRecorder.start(1000); 
//       setIsRecording(true);
//       setAudioFile(null); 
//     } catch (error) {
//       console.error("Error al iniciar la grabación:", error);
//       alert("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
//     }
//   };

//   const stopRecording = () => {
//     if (mediaRecorderRef.current && isRecording && mediaRecorderRef.current.state !== 'inactive') {
//       mediaRecorderRef.current.stop();
//       setIsRecording(false);
//     }
//   };

//   const cancelRecording = () => {
//       setAudioFile(null);
//       setIsRecording(false);
//       setRecordTime(0);
//       setRecordedDuration(0);
//       audioChunksRef.current = [];
//       // Asegurarse de detener streams si se cancela abruptamente
//       if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
//           mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
//       }
//   };

//   const handleTimeUpdate = () => {
//     if (audioRef.current) {
//       setCurrentTime(audioRef.current.currentTime);
//     }
//   };

//   const handleProgressChange = (event) => {
//     if (audioRef.current) {
//       const newTime = parseFloat(event.target.value);
//       audioRef.current.currentTime = newTime;
//       setCurrentTime(newTime);
//     }
//   };

//   // -------------------------------
//   // 3. Lógica de Envío
//   // -------------------------------
  
//   const sendAudioMessage = () => {
//     if (!audioChunksRef.current.length) return;

//     // Usar el mimetype real del recorder
//     const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
//     const blob = new Blob(audioChunksRef.current, { type: mimeType });

//     // Usar FileReader es más seguro que atob para archivos binarios grandes
//     const reader = new FileReader();
//     reader.readAsDataURL(blob);
//     reader.onloadend = () => {
//         const base64String = reader.result;
//         const base64Pure = base64String.split(',')[1]; // Remover prefijo data:audio/...

//         const payload = { file: base64Pure, fileName: `audio-${Date.now()}.webm`, fileType: mimeType };
        
//         const localMsg = { 
//             ...payload, 
//             type: "audio", 
//             from: USER_ID, 
//             timestamp: Date.now(), 
//             audioURL: audioFile, 
//             seen: false 
//         };

//         if (selectedUser) {
//             socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//             setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//         } else {
//             socketRef.current.emit("send-file", payload);
//             setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//         }

//         cancelRecording();
//     };
//   };

//   const sendText = () => {
//     if (!text.trim()) return;
//     const msg = { type: "text", content: text };
//     const localMsg = { ...msg, from: USER_ID, timestamp: Date.now() };

//     if (selectedUser) {
//       socketRef.current.emit("private-message", { to: selectedUser, message: text });
//       setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//     } else {
//       socketRef.current.emit("send-message", msg);
//       setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//     }
//     setText("");
//     setShowEmojiPicker(false);
//   };

//   const sendFileFromInput = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onloadend = () => {
//         const isAudio = file.type.startsWith("audio/");
//         const base64Pure = reader.result.split(',')[1];
//         const payload = { file: base64Pure, fileName: file.name, fileType: file.type };
//         const localMsg = { ...payload, type: isAudio ? "audio" : "file", from: USER_ID, timestamp: Date.now(), audioURL: isAudio ? getAudioURLFromBase64(payload.file, payload.fileType) : undefined };

//         if (selectedUser) {
//             socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//             setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//         } else {
//             socketRef.current.emit("send-file", payload);
//             setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//         }
//     };
//     reader.readAsDataURL(file);
//     e.target.value = null;
//   };

//   // -------------------------------
//   // Render
//   // -------------------------------
//   const onEmojiClick = (emojiObject) => setText((prev) => prev + emojiObject.emoji);
//   const visibleMessages = selectedUser === null ? publicMessages : privateChats[selectedUser] || [];

//   useEffect(() => {
//     if (selectedUser && socketRef.current) {
//       socketRef.current.emit("message-seen", { to: selectedUser });
//       setPrivateChats((prev) => {
//         const msgs = prev[selectedUser]?.map((m) => m.from !== USER_ID ? { ...m, seen: true } : m);
//         return { ...prev, [selectedUser]: msgs };
//       });
//     }
//   }, [selectedUser]);

//   return (
//     <div className={`${darkMode ? "dark" : ""} flex h-screen overflow-hidden`}>
      
//       {/* IMPORTANTÍSIMO: He eliminado <AudioRecorder/> de aquí porque ya tienes la lógica integrada abajo.
//           Tenerlo aquí duplicaba el acceso al micrófono y causaba errores en Chrome. */}
      
//       {/* Sidebar */}
//       <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 shadow-lg ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:flex flex-col`}>
//         <h2 className="px-6 py-5 font-bold text-xl">Usuarios</h2>
//         <button onClick={() => setSelectedUser(null)} className={`w-full text-left p-4 my-1 rounded-xl ${selectedUser === null ? "bg-green-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>🌍 Chat Público</button>
//         <ul className="flex-1 overflow-y-auto">
//             {activeUsers.map(u => <li key={u} onClick={() => setSelectedUser(u)} className={`p-4 cursor-pointer rounded-xl ${selectedUser === u ? "bg-green-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>👤 {u}</li>)}
//         </ul>
//         <div className="p-4 border-t flex justify-between items-center">
//             <span className="dark:text-white">Modo oscuro</span>
//             <input type="checkbox" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
//         </div>
//       </div>

//       {/* Area de Chat */}
//       <div className="flex-1 flex flex-col md:ml-64 bg-gray-50 dark:bg-gray-800 transition-colors">
//         <div className="bg-green-500 px-6 py-4 flex justify-between text-white shadow-md">
//           <h1 className="font-semibold">{selectedUser ? `Chat con ${selectedUser}` : "Chat Público"}</h1>
//           <span className="text-xs opacity-75">ID: {USER_ID}</span>
//         </div>

//         <div className="flex-1 overflow-y-auto p-4 space-y-3">
//             {visibleMessages.map((msg, i) => {
//                 const isMe = msg.from === USER_ID;
//                 return (
//                     <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
//                         <div className={`max-w-[75%] p-3 rounded-2xl shadow-md break-words ${isMe ? "bg-green-500 text-white rounded-br-none" : "bg-gray-200 text-gray-900 rounded-bl-none"}`}>
//                             {msg.type === "text" && <p>{msg.content}</p>}
//                             {(msg.type === "audio" || msg.type === "file") && (
//                                 <div className="mt-1">
//                                     {msg.type === "audio" && msg.audioURL ? (
//                                         <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg min-w-[220px]">
//                                             <Volume2 className="h-5 w-5 flex-shrink-0" />
//                                             <audio controls src={msg.audioURL} className="w-full h-8" />
//                                         </div>
//                                     ) : msg.fileType?.startsWith("image") ? (
//                                         <img src={`data:${msg.fileType};base64,${msg.file}`} alt="img" className="rounded-lg max-h-48" />
//                                     ) : (
//                                         <a href={`data:${msg.fileType};base64,${msg.file}`} download={msg.fileName} className="underline flex items-center gap-1 font-medium"><Paperclip className="h-4 w-4"/>{msg.fileName}</a>
//                                     )}
//                                 </div>
//                             )}
//                             <div className="text-right text-xs mt-1 opacity-70">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
//                         </div>
//                     </div>
//                 )
//             })}
//             <div ref={bottomRef}></div>
//         </div>

//         {showEmojiPicker && <div className="absolute bottom-20 right-4 z-50"><Picker onEmojiClick={onEmojiClick} /></div>}

//         {/* --- BARRA DE ENTRADA DINÁMICA --- */}
//         <div className="p-3 bg-white dark:bg-gray-900 border-t dark:border-gray-700 shadow-lg">
            
//             {audioFile && (
//                 <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-bottom-2">
//                     <button onClick={cancelRecording} className="p-3 text-red-500 hover:bg-red-100 rounded-full transition-colors">
//                         <Trash2 className="w-5 h-5" />
//                     </button>

//                     <div className="flex-1 flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-2 rounded-full px-4">
//                         <button onClick={togglePlay} className="text-blue-500">
//                             {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
//                         </button>
                        
//                         <div className="flex-1 flex flex-col w-full">
//                             <input
//                                 type="range"
//                                 min="0"
//                                 max={recordedDuration || 0}
//                                 value={currentTime}
//                                 step="0.1"
//                                 onChange={handleProgressChange}
//                                 className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
//                             />
//                             <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
//                                 <span>{formatTime(currentTime)}</span>
//                                 <span>{formatTime(recordedDuration)}</span>
//                             </div>
//                         </div>

//                         <audio
//                             ref={audioRef}
//                             src={audioFile}
//                             onTimeUpdate={handleTimeUpdate}
//                             onEnded={() => setIsPlaying(false)}
//                             className="hidden"
//                         />
//                     </div>

//                     <button onClick={sendAudioMessage} className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg">
//                         <SendHorizontal className="w-5 h-5" />
//                     </button>
//                 </div>
//             )}

//             {!audioFile && isRecording && (
//                 <div className="flex items-center justify-between w-full px-2 animate-pulse">
//                      <div className="flex items-center gap-2 text-red-500 font-mono font-bold">
//                         <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
//                         Grabando: {formatTime(recordTime)}
//                      </div>
//                      <button onClick={stopRecording} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg">
//                         <StopCircle className="w-6 h-6" />
//                      </button>
//                 </div>
//             )}

//             {!audioFile && !isRecording && (
//                 <div className="flex items-center gap-2">
//                     <button onClick={() => fileInputRef.current.click()} className="p-2 rounded-full bg-yellow-400 hover:bg-yellow-300"><Paperclip className="h-5 w-5 text-black" /></button>
//                     <input type="file" hidden ref={fileInputRef} onChange={sendFileFromInput} />
                    
//                     <input 
//                         className="flex-1 rounded-full px-5 py-3 bg-gray-100 dark:bg-gray-700 dark:text-white border-none focus:ring-2 focus:ring-green-500 outline-none transition-all" 
//                         placeholder="Escribe un mensaje..." 
//                         value={text}
//                         onChange={(e) => setText(e.target.value)}
//                         onKeyDown={(e) => e.key === "Enter" && sendText()} 
//                     />
                    
//                     <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300">😃</button>

//                     <div className="relative">
//                         <button onClick={() => setShowMicSettings(!showMicSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
//                             <Settings className="h-5 w-5" />
//                         </button>
//                         {showMicSettings && (
//                              <div className="absolute bottom-14 right-0 w-48 bg-white dark:bg-gray-800 shadow-xl border rounded p-2 z-50">
//                                 <p className="text-xs font-bold text-gray-500 mb-1">Micrófono:</p>
//                                 <select 
//                                     className="w-full text-xs p-1 border rounded dark:bg-gray-700 dark:text-white"
//                                     value={selectedDeviceId}
//                                     onChange={(e) => { setSelectedDeviceId(e.target.value); setShowMicSettings(false); }}
//                                 >
//                                     {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Default"}</option>)}
//                                 </select>
//                              </div>
//                         )}
//                     </div>

//                     <button onClick={startRecording} className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md">
//                         <Mic className="h-5 w-5" />
//                     </button>
                    
//                     {text.trim() && (
//                         <button onClick={sendText} className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 shadow-md ml-1">
//                             <SendHorizontal className="h-5 w-5" />
//                         </button>
//                     )}
//                 </div>
//             )}
//         </div>
//       </div>
//     </div>
//   );
// }























//FUNCIONA EN EDGE
// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";
// import Picker from "emoji-picker-react";
// import { SendHorizontal, Paperclip, Mic, StopCircle, Volume2, Settings, Play, Pause, Trash2 } from "lucide-react";
// import AudioRecorder from '@/components/AudioRecorder'
// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// // Helper para convertir Base64 a URL (para mensajes recibidos)
// const getAudioURLFromBase64 = (base64Data, fileType) => {
//   if (!base64Data || typeof base64Data !== 'string') return "";
//   const type = fileType || "audio/webm";
//   try {
//     const byteString = atob(base64Data);
//     const ab = new ArrayBuffer(byteString.length);
//     const ia = new Uint8Array(ab);
//     for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
//     return URL.createObjectURL(new Blob([ab], { type }));
//   } catch (e) {
//     console.error(e);
//     return "";
//   }
// };

// export default function ChatPage() {
//   // --- ESTADOS DEL CHAT ---
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [darkMode, setDarkMode] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   // --- ESTADOS DE AUDIO (Basado en tu componente AudioRecorder) ---
//   const [audioFile, setAudioFile] = useState(null); // URL del blob local
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isRecording, setIsRecording] = useState(false);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [recordedDuration, setRecordedDuration] = useState(0);
//   const [recordTime, setRecordTime] = useState(0);
  
//   // Configuración de Micro
//   const [audioDevices, setAudioDevices] = useState([]);
//   const [selectedDeviceId, setSelectedDeviceId] = useState("");
//   const [showMicSettings, setShowMicSettings] = useState(false);

//   // --- REFS ---
//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);
//   const socketRef = useRef(null);
  
//   // Refs de Audio
//   const audioRef = useRef(null);
//   const mediaRecorderRef = useRef(null);
//   const audioChunksRef = useRef([]);
//   const recordTimeRef = useRef(0);

//   // -------------------------------
//   // 1. Inicializar Socket
//   // -------------------------------
//   useEffect(() => {
//     socketRef.current = io("http://localhost:4000", { query: { userId: USER_ID } });

//     socketRef.current.on("receive-message", (msg) => {
//       const newMsg = { ...msg };
//       // Si llega un audio, convertimos Base64 a URL jugable
//       if (newMsg.fileType?.startsWith("audio/") && newMsg.file) {
//         newMsg.audioURL = getAudioURLFromBase64(newMsg.file, newMsg.fileType);
//         newMsg.type = "audio";
//       }
      
//       if (newMsg.private) {
//         const otherUser = newMsg.from === USER_ID ? newMsg.to : newMsg.from;
//         setPrivateChats((prev) => {
//           const msgs = prev[otherUser] || [];
//           return { ...prev, [otherUser]: [...msgs, { ...newMsg }] };
//         });
//       } else {
//         setPublicMessages((prev) => [...prev, { ...newMsg }]);
//       }
//     });

//     socketRef.current.on("active-users", (users) => setActiveUsers(users.filter((u) => u !== USER_ID)));

//     // Cargar micrófonos
//     const getMicrophones = async () => {
//         try {
//             await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
//             const devices = await navigator.mediaDevices.enumerateDevices();
//             const inputs = devices.filter(d => d.kind === 'audioinput');
//             setAudioDevices(inputs);
//             if(inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId);
//         } catch(e) { console.error("Error permisos micro:", e); }
//     };
//     getMicrophones();

//     return () => socketRef.current && socketRef.current.disconnect();
//   }, []);

//   // Scroll al final al recibir mensajes
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser, audioFile, isRecording]); // Añadido audioFile/isRecording para scroll al cambiar UI

//   // -------------------------------
//   // 2. Lógica de Audio (Tu componente integrado)
//   // -------------------------------

//   // Formato de tiempo mm:ss
//   const formatTime = (time) => {
//     if (!isFinite(time) || isNaN(time)) return "00:00";
//     const minutes = Math.floor(time / 60);
//     const seconds = Math.floor(time % 60);
//     return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
//   };

//   // Limpieza de URL
//   useEffect(() => {
//     return () => {
//       if (audioFile) URL.revokeObjectURL(audioFile);
//     };
//   }, [audioFile]);

//   // Timer de grabación
//   useEffect(() => {
//     let interval;
//     if (isRecording) {
//       setRecordTime(0);
//       recordTimeRef.current = 0;
//       interval = setInterval(() => {
//         setRecordTime((prev) => {
//           const newVal = prev + 1;
//           recordTimeRef.current = newVal;
//           return newVal;
//         });
//       }, 1000);
//     } else {
//         // No reseteamos aquí para mantener el último tiempo si paramos
//     }
//     return () => { if (interval) clearInterval(interval); };
//   }, [isRecording]);

//   const togglePlay = () => {
//     if (audioRef.current) {
//       if (isPlaying) {
//         audioRef.current.pause();
//       } else {
//         audioRef.current.play();
//       }
//       setIsPlaying(!isPlaying);
//     }
//   };

//   const startRecording = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ 
//           audio: {
//             deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
//             echoCancellation: true,
//             noiseSuppression: true,
//             autoGainControl: true
//           } 
//       });

//       // Opciones para mejorar calidad
//       let options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
//       if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'audio/webm' };

//       const mediaRecorder = new MediaRecorder(stream, options);
//       mediaRecorderRef.current = mediaRecorder;
//       audioChunksRef.current = [];

//       mediaRecorder.ondataavailable = (event) => {
//         if (event.data.size > 0) {
//           audioChunksRef.current.push(event.data);
//         }
//       };

//       mediaRecorder.onstop = () => {
//         // Crear Blob final
//         const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        
//         if (audioFile) URL.revokeObjectURL(audioFile);
        
//         const audioURL = URL.createObjectURL(audioBlob);
//         setAudioFile(audioURL); // Esto activa la vista de "Previsualización"
        
//         setIsPlaying(false);
//         setCurrentTime(0);
//         setRecordedDuration(recordTimeRef.current); // Guardar duración final

//         // Detener tracks
//         mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
//       };

//       mediaRecorder.start(1000); // Timeslice 1s
//       setIsRecording(true);
//       setAudioFile(null); // Limpiar anterior
//     } catch (error) {
//       console.error("Error al iniciar la grabación:", error);
//       alert("No se pudo acceder al micrófono.");
//     }
//   };

//   const stopRecording = () => {
//     if (mediaRecorderRef.current && isRecording) {
//       mediaRecorderRef.current.stop();
//       setIsRecording(false);
//     }
//   };

//   const cancelRecording = () => {
//       setAudioFile(null);
//       setIsRecording(false);
//       setRecordTime(0);
//       setRecordedDuration(0);
//       audioChunksRef.current = [];
//   };

//   const handleTimeUpdate = () => {
//     if (audioRef.current) {
//       setCurrentTime(audioRef.current.currentTime);
//     }
//   };

//   const handleProgressChange = (event) => {
//     if (audioRef.current) {
//       const newTime = parseFloat(event.target.value);
//       audioRef.current.currentTime = newTime;
//       setCurrentTime(newTime);
//     }
//   };

//   // -------------------------------
//   // 3. Lógica de Envío (Texto y Audio)
//   // -------------------------------
  
//   // Enviar Audio Confirmado
//   const sendAudioMessage = () => {
//     if (!audioChunksRef.current.length) return;

//     // Recrear el blob desde los chunks (usamos el mimeType guardado o defecto)
//     const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
//     const blob = new Blob(audioChunksRef.current, { type: mimeType });

//     const reader = new FileReader();
//     reader.onloadend = () => {
//         const base64Pure = reader.result.split(',')[1];
//         const payload = { file: base64Pure, fileName: `audio-${Date.now()}.webm`, fileType: mimeType };
        
//         // Mensaje local para UI inmediata
//         const localMsg = { 
//             ...payload, 
//             type: "audio", 
//             from: USER_ID, 
//             timestamp: Date.now(), 
//             audioURL: audioFile, // Usamos la URL local que ya generamos
//             seen: false 
//         };

//         if (selectedUser) {
//             socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//             setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//         } else {
//             socketRef.current.emit("send-file", payload);
//             setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//         }

//         // Limpiar estado después de enviar
//         cancelRecording();
//     };
//     reader.readAsDataURL(blob);
//   };

//   const sendText = () => {
//     if (!text.trim()) return;
//     const msg = { type: "text", content: text };
//     const localMsg = { ...msg, from: USER_ID, timestamp: Date.now() };

//     if (selectedUser) {
//       socketRef.current.emit("private-message", { to: selectedUser, message: text });
//       setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//     } else {
//       socketRef.current.emit("send-message", msg);
//       setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//     }
//     setText("");
//     setShowEmojiPicker(false);
//   };

//   const sendFileFromInput = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onloadend = () => {
//         const isAudio = file.type.startsWith("audio/");
//         const base64Pure = reader.result.split(',')[1];
//         const payload = { file: base64Pure, fileName: file.name, fileType: file.type };
//         const localMsg = { ...payload, type: isAudio ? "audio" : "file", from: USER_ID, timestamp: Date.now(), audioURL: isAudio ? getAudioURLFromBase64(payload.file, payload.fileType) : undefined };

//         if (selectedUser) {
//             socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//             setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
//         } else {
//             socketRef.current.emit("send-file", payload);
//             setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
//         }
//     };
//     reader.readAsDataURL(file);
//     e.target.value = null;
//   };

//   // -------------------------------
//   // Render
//   // -------------------------------
//   const onEmojiClick = (emojiObject) => setText((prev) => prev + emojiObject.emoji);
//   const visibleMessages = selectedUser === null ? publicMessages : privateChats[selectedUser] || [];

//   useEffect(() => {
//     if (selectedUser && socketRef.current) {
//       socketRef.current.emit("message-seen", { to: selectedUser });
//       setPrivateChats((prev) => {
//         const msgs = prev[selectedUser]?.map((m) => m.from !== USER_ID ? { ...m, seen: true } : m);
//         return { ...prev, [selectedUser]: msgs };
//       });
//     }
//   }, [selectedUser]);

//   return (
//     <div className={`${darkMode ? "dark" : ""} flex h-screen overflow-hidden`}>
//       {/* Sidebar */}

//       <AudioRecorder/>
//       <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 shadow-lg ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:flex flex-col`}>
//         <h2 className="px-6 py-5 font-bold text-xl">Usuarios</h2>
//         <button onClick={() => setSelectedUser(null)} className={`w-full text-left p-4 my-1 rounded-xl ${selectedUser === null ? "bg-green-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>🌍 Chat Público</button>
//         <ul className="flex-1 overflow-y-auto">
//             {activeUsers.map(u => <li key={u} onClick={() => setSelectedUser(u)} className={`p-4 cursor-pointer rounded-xl ${selectedUser === u ? "bg-green-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>👤 {u}</li>)}
//         </ul>
//         <div className="p-4 border-t flex justify-between items-center">
//             <span className="dark:text-white">Modo oscuro</span>
//             <input type="checkbox" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
//         </div>
//       </div>

//       {/* Area de Chat */}
//       <div className="flex-1 flex flex-col md:ml-64 bg-gray-50 dark:bg-gray-800 transition-colors">
//         <div className="bg-green-500 px-6 py-4 flex justify-between text-white shadow-md">
//           <h1 className="font-semibold">{selectedUser ? `Chat con ${selectedUser}` : "Chat Público"}</h1>
//           <span className="text-xs opacity-75">ID: {USER_ID}</span>
//         </div>

//         <div className="flex-1 overflow-y-auto p-4 space-y-3">
//             {visibleMessages.map((msg, i) => {
//                 const isMe = msg.from === USER_ID;
//                 return (
//                     <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
//                         <div className={`max-w-[75%] p-3 rounded-2xl shadow-md break-words ${isMe ? "bg-green-500 text-white rounded-br-none" : "bg-gray-200 text-gray-900 rounded-bl-none"}`}>
//                             {msg.type === "text" && <p>{msg.content}</p>}
//                             {(msg.type === "audio" || msg.type === "file") && (
//                                 <div className="mt-1">
//                                     {msg.type === "audio" && msg.audioURL ? (
//                                         <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg min-w-[220px]">
//                                             <Volume2 className="h-5 w-5 flex-shrink-0" />
//                                             <audio controls src={msg.audioURL} className="w-full h-8" />
//                                         </div>
//                                     ) : msg.fileType?.startsWith("image") ? (
//                                         <img src={`data:${msg.fileType};base64,${msg.file}`} alt="img" className="rounded-lg max-h-48" />
//                                     ) : (
//                                         <a href={`data:${msg.fileType};base64,${msg.file}`} download={msg.fileName} className="underline flex items-center gap-1 font-medium"><Paperclip className="h-4 w-4"/>{msg.fileName}</a>
//                                     )}
//                                 </div>
//                             )}
//                             <div className="text-right text-xs mt-1 opacity-70">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
//                         </div>
//                     </div>
//                 )
//             })}
//             <div ref={bottomRef}></div>
//         </div>

//         {showEmojiPicker && <div className="absolute bottom-20 right-4 z-50"><Picker onEmojiClick={onEmojiClick} /></div>}

//         {/* --- BARRA DE ENTRADA DINÁMICA --- */}
//         <div className="p-3 bg-white dark:bg-gray-900 border-t dark:border-gray-700 shadow-lg">
            
//             {/* ESTADO 1: PREVISUALIZACIÓN (Audio grabado listo para enviar) */}
//             {audioFile && (
//                 <div className="flex items-center gap-3 w-full animate-in fade-in slide-in-from-bottom-2">
//                      {/* Botón Eliminar */}
//                     <button onClick={cancelRecording} className="p-3 text-red-500 hover:bg-red-100 rounded-full transition-colors">
//                         <Trash2 className="w-5 h-5" />
//                     </button>

//                     {/* Reproductor */}
//                     <div className="flex-1 flex items-center gap-3 bg-gray-100 dark:bg-gray-800 p-2 rounded-full px-4">
//                         <button onClick={togglePlay} className="text-blue-500">
//                             {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
//                         </button>
                        
//                         <div className="flex-1 flex flex-col w-full">
//                             <input
//                                 type="range"
//                                 min="0"
//                                 max={recordedDuration || 0}
//                                 value={currentTime}
//                                 step="0.1"
//                                 onChange={handleProgressChange}
//                                 className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
//                             />
//                             <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
//                                 <span>{formatTime(currentTime)}</span>
//                                 <span>{formatTime(recordedDuration)}</span>
//                             </div>
//                         </div>

//                         {/* Elemento audio oculto para la lógica */}
//                         <audio
//                             ref={audioRef}
//                             src={audioFile}
//                             onTimeUpdate={handleTimeUpdate}
//                             onEnded={() => setIsPlaying(false)}
//                             className="hidden"
//                         />
//                     </div>

//                     {/* Botón Enviar */}
//                     <button onClick={sendAudioMessage} className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg">
//                         <SendHorizontal className="w-5 h-5" />
//                     </button>
//                 </div>
//             )}

//             {/* ESTADO 2: GRABANDO (Timer y Botón Parar) */}
//             {!audioFile && isRecording && (
//                 <div className="flex items-center justify-between w-full px-2 animate-pulse">
//                      <div className="flex items-center gap-2 text-red-500 font-mono font-bold">
//                         <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
//                         Grabando: {formatTime(recordTime)}
//                      </div>
//                      <button onClick={stopRecording} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg">
//                         <StopCircle className="w-6 h-6" />
//                      </button>
//                 </div>
//             )}

//             {/* ESTADO 3: INPUT NORMAL (Texto y Botón Mic) */}
//             {!audioFile && !isRecording && (
//                 <div className="flex items-center gap-2">
//                     <button onClick={() => fileInputRef.current.click()} className="p-2 rounded-full bg-yellow-400 hover:bg-yellow-300"><Paperclip className="h-5 w-5 text-black" /></button>
//                     <input type="file" hidden ref={fileInputRef} onChange={sendFileFromInput} />
                    
//                     <input 
//                         className="flex-1 rounded-full px-5 py-3 bg-gray-100 dark:bg-gray-700 dark:text-white border-none focus:ring-2 focus:ring-green-500 outline-none transition-all" 
//                         placeholder="Escribe un mensaje..." 
//                         value={text}
//                         onChange={(e) => setText(e.target.value)}
//                         onKeyDown={(e) => e.key === "Enter" && sendText()} 
//                     />
                    
//                     <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300">😃</button>

//                     {/* Selector de Micrófono */}
//                     <div className="relative">
//                         <button onClick={() => setShowMicSettings(!showMicSettings)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
//                             <Settings className="h-5 w-5" />
//                         </button>
//                         {showMicSettings && (
//                              <div className="absolute bottom-14 right-0 w-48 bg-white dark:bg-gray-800 shadow-xl border rounded p-2 z-50">
//                                 <p className="text-xs font-bold text-gray-500 mb-1">Micrófono:</p>
//                                 <select 
//                                     className="w-full text-xs p-1 border rounded dark:bg-gray-700 dark:text-white"
//                                     value={selectedDeviceId}
//                                     onChange={(e) => { setSelectedDeviceId(e.target.value); setShowMicSettings(false); }}
//                                 >
//                                     {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Default"}</option>)}
//                                 </select>
//                              </div>
//                         )}
//                     </div>

//                     <button onClick={startRecording} className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md">
//                         <Mic className="h-5 w-5" />
//                     </button>
                    
//                     {text.trim() && (
//                         <button onClick={sendText} className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 shadow-md ml-1">
//                             <SendHorizontal className="h-5 w-5" />
//                         </button>
//                     )}
//                 </div>
//             )}
//         </div>
//       </div>
//     </div>
//   );
// }








// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";
// import Picker from "emoji-picker-react";
// import { SendHorizontal, Paperclip, Mic, StopCircle } from "lucide-react";

// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// // -------------------------------
// // Función para obtener URL de audio
// // -------------------------------
// const getAudioURL = (file, fileType) => {
//   if (file.startsWith("data:")) return file;
//   const byteString = atob(file.split(",")[1]);
//   const ab = new ArrayBuffer(byteString.length);
//   const ia = new Uint8Array(ab);
//   for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
//   return URL.createObjectURL(new Blob([ab], { type: fileType || "audio/webm" }));
// };

// export default function ChatPage() {
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [darkMode, setDarkMode] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);
//   const [recording, setRecording] = useState(false);
//   const [mediaRecorder, setMediaRecorder] = useState(null);

//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);
//   const socketRef = useRef(null);

//   // -------------------------------
//   // Inicializar socket.io
//   // -------------------------------
//   useEffect(() => {
//     socketRef.current = io("http://localhost:4000", { query: { userId: USER_ID } });

//     socketRef.current.on("connect", () => {
//       console.log("🔵 Conectado al socket:", socketRef.current.id);
//     });

//     socketRef.current.on("receive-message", (msg) => {
//       const newMsg = { ...msg };

//       if ((newMsg.type === "audio" || newMsg.fileType?.startsWith("audio/")) && newMsg.file) {
//         newMsg.audioURL = getAudioURL(newMsg.file, newMsg.fileType);
//       }

//       if (newMsg.private) {
//         const otherUser = newMsg.from === USER_ID ? newMsg.to : newMsg.from;
//         setPrivateChats((prev) => {
//           const prevMsgs = prev[otherUser] || [];
//           if (newMsg.from === USER_ID && newMsg.seen === undefined) newMsg.seen = false;
//           return { ...prev, [otherUser]: [...prevMsgs, { ...newMsg }] };
//         });
//       } else {
//         setPublicMessages((prev) => [...prev, { ...newMsg }]);
//       }
//     });

//     socketRef.current.on("active-users", (users) => {
//       setActiveUsers(users.filter((u) => u !== USER_ID));
//     });

//     socketRef.current.on("message-seen", ({ from }) => {
//       setPrivateChats((prev) => {
//         const msgs = prev[from]?.map((m) =>
//           m.from === USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [from]: msgs };
//       });
//     });

//     return () => socketRef.current && socketRef.current.disconnect();
//   }, []);

//   // -------------------------------
//   // Scroll al final
//   // -------------------------------
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser]);

//   // -------------------------------
//   // Enviar texto
//   // -------------------------------
//   const sendText = () => {
//     if (!text.trim()) return;

//     const messagePayload = { type: "text", message: text };
//     if (selectedUser) {
//       socketRef.current.emit("private-message", { to: selectedUser, ...messagePayload });
//     } else {
//       socketRef.current.emit("send-message", messagePayload);
//     }

//     setText("");
//     setShowEmojiPicker(false);
//   };

//   // -------------------------------
//   // Enviar archivo
//   // -------------------------------
//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       const isAudio = file.type.startsWith("audio/");
//       const payload = {
//         file: reader.result,
//         fileName: file.name,
//         fileType: file.type,
//         type: isAudio ? "audio" : "file",
//       };

//       if (selectedUser) {
//         socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//       } else {
//         socketRef.current.emit("send-file", payload);
//       }
//     };
//     reader.readAsDataURL(file);
//   };

//   // -------------------------------
//   // Grabación de audio
//   // -------------------------------
//   const startRecording = async () => {
//     if (!navigator.mediaDevices?.getUserMedia) {
//       alert("Tu navegador no soporta grabación de audio");
//       return;
//     }

//     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     const recorder = new MediaRecorder(stream);
//     const chunks = [];

//     recorder.ondataavailable = (e) => chunks.push(e.data);
//     recorder.onstop = () => {
//       const blob = new Blob(chunks, { type: "audio/webm" });
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         const payload = {
//           file: reader.result,
//           fileName: `audio-${Date.now()}.webm`,
//           fileType: blob.type,
//           type: "audio",
//         };

//         if (selectedUser) {
//           socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//         } else {
//           socketRef.current.emit("send-file", payload);
//         }
//       };
//       reader.readAsDataURL(blob);
//     };

//     recorder.start();
//     setMediaRecorder(recorder);
//     setRecording(true);
//   };

//   const stopRecording = () => {
//     if (mediaRecorder) {
//       mediaRecorder.stop();
//       setRecording(false);
//     }
//   };

//   // -------------------------------
//   // Emoji
//   // -------------------------------
//   const onEmojiClick = (emojiObject) => setText((prev) => prev + emojiObject.emoji);

//   const visibleMessages = selectedUser === null ? publicMessages : privateChats[selectedUser] || [];

//   // -------------------------------
//   // Marcar mensajes como vistos
//   // -------------------------------
//   useEffect(() => {
//     if (selectedUser && socketRef.current) {
//       socketRef.current.emit("message-seen", { to: selectedUser });
//       setPrivateChats((prev) => {
//         const msgs = prev[selectedUser]?.map((m) =>
//           m.from !== USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [selectedUser]: msgs };
//       });
//     }
//   }, [selectedUser]);

//   // -------------------------------
//   // Render
//   // -------------------------------
//   return (
//     <div className={`${darkMode ? "dark" : ""} flex h-screen overflow-hidden`}>
//       {/* Sidebar */}
//       <div
//         className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 shadow-lg
//         ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:flex flex-col`}
//       >
//         <h2 className="px-6 py-5 font-bold text-xl border-b border-gray-200 dark:border-gray-700">
//           Usuarios Activos
//         </h2>

//         <button
//           onClick={() => {
//             setSelectedUser(null);
//             setSidebarOpen(false);
//           }}
//           className={`w-full text-left p-4 my-1 hover:bg-yellow-400 transition-all duration-300 rounded-xl ${
//             selectedUser === null ? "bg-green-500 text-white shadow-lg" : ""
//           }`}
//         >
//           🌍 Chat Público
//         </button>

//         <ul className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
//           {activeUsers.map((user) => (
//             <li
//               key={user}
//               onClick={() => {
//                 setSelectedUser(user);
//                 setSidebarOpen(false);
//               }}
//               className={`p-4 cursor-pointer hover:bg-yellow-400 transition-all duration-300 rounded-xl ${
//                 selectedUser === user ? "bg-green-500 text-white shadow-lg" : ""
//               }`}
//             >
//               👤 {user}
//             </li>
//           ))}
//           {activeUsers.length === 0 && (
//             <li className="p-4 text-gray-400 dark:text-gray-500 text-sm">Nadie conectado</li>
//           )}
//         </ul>

//         <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
//           <span className="text-gray-700 dark:text-gray-300">Modo oscuro</span>
//           <input
//             type="checkbox"
//             checked={darkMode}
//             onChange={() => setDarkMode(!darkMode)}
//             className="cursor-pointer"
//           />
//         </div>
//       </div>

//       {/* Botón para abrir sidebar en móvil */}
//       <button
//         className="fixed top-4 left-4 z-50 md:hidden p-3 bg-green-500 text-white rounded-full shadow-lg"
//         onClick={() => setSidebarOpen(true)}
//       >
//         ☰
//       </button>

//       {/* Chat */}
//       <div className="flex-1 flex flex-col md:ml-64 bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
//         {/* Header */}
//         <div className="bg-green-500 dark:bg-green-600 text-white px-6 py-4 flex justify-between items-center shadow-md">
//           <h1 className="text-lg font-semibold">{selectedUser ? `Chat con ${selectedUser}` : "Chat Público"}</h1>
//           <span className="text-sm opacity-80">ID: {USER_ID}</span>
//         </div>

//         {/* Mensajes */}
//         <div className="flex-1 overflow-y-auto p-4 space-y-3 md:p-6 bg-gray-50">
//           {visibleMessages.map((msg, i) => {
//             const isMe = msg.from === USER_ID;
//             return (
//               <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
//                 <div
//                   className={`relative max-w-[75%] p-3 rounded-2xl break-words
//                     ${isMe
//                       ? "bg-green-500 text-white self-end rounded-br-none"
//                       : "bg-gray-200 text-gray-900 self-start rounded-bl-none"}`}
//                 >
//                   {msg.type === "text" && <p>{msg.message || msg.content}</p>}
//                   {(msg.type === "file" || msg.type === "audio") && (
//                     <div className="mt-1">
//                       {msg.type === "audio" && msg.audioURL ? (
//                         <audio controls className="w-full rounded-lg">
//                           <source src={msg.audioURL} type={msg.fileType} />
//                           Tu navegador no soporta audio.
//                         </audio>
//                       ) : msg.fileType?.startsWith("image") ? (
//                         <img src={msg.file} alt={msg.fileName} className="rounded-lg max-h-48 shadow-sm" />
//                       ) : (
//                         <a
//                           href={msg.file}
//                           download={msg.fileName}
//                           className={`underline ${isMe ? "text-white" : "text-blue-700"}`}
//                         >
//                           📎 {msg.fileName}
//                         </a>
//                       )}
//                     </div>
//                   )}
//                   {isMe && selectedUser && (
//                     <span className="absolute bottom-0 right-1 text-xs text-gray-500">
//                       {msg.seen ? "✔✔" : "✔"} {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
//                     </span>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//           <div ref={bottomRef}></div>
//         </div>

//         {showEmojiPicker && (
//           <div className="absolute bottom-20 right-4 z-50">
//             <Picker onEmojiClick={onEmojiClick} theme={darkMode ? "dark" : "light"} />
//           </div>
//         )}

//         {/* Input fijo en móvil */}
//         <div className="p-3 flex items-center gap-3 shadow-lg fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-white dark:bg-gray-900 transition-colors duration-300">
//           <button
//             onClick={() => fileInputRef.current.click()}
//             className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 shadow-lg"
//           >
//             <Paperclip className="stroke-gray-950" />
//           </button>
//           <input type="file" hidden ref={fileInputRef} onChange={sendFile} />

//           <input
//             className={`flex-1 rounded-full px-5 py-3 focus:outline-none border ${
//               darkMode
//                 ? "bg-gray-700 text-white border-gray-600 focus:border-green-500"
//                 : "bg-gray-100 text-gray-900 border-gray-300 focus:border-green-500"
//             } transition-all duration-300 shadow-inner`}
//             placeholder="Escribe un mensaje..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && sendText()}
//           />

//           <button
//             onClick={() => setShowEmojiPicker((prev) => !prev)}
//             className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 shadow-lg"
//           >
//             😃
//           </button>

//           {!recording ? (
//             <button
//               onClick={startRecording}
//               className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-lg"
//             >
//               <Mic />
//             </button>
//           ) : (
//             <button
//               onClick={stopRecording}
//               className="p-3 rounded-full bg-gray-700 hover:bg-gray-800 transition-all duration-300 shadow-lg"
//             >
//               <StopCircle />
//             </button>
//           )}

//           <button
//             onClick={sendText}
//             className="bg-green-500 text-white px-5 py-3 rounded-full hover:bg-green-600 transition-all duration-300 shadow-lg"
//           >
//             <SendHorizontal />
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }





// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";
// import Picker from "emoji-picker-react";
// import { SendHorizontal, Paperclip, Mic, StopCircle } from "lucide-react";

// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// export default function ChatPage() {
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [darkMode, setDarkMode] = useState(false);
//   const [recording, setRecording] = useState(false);
//   const [mediaRecorder, setMediaRecorder] = useState(null);

//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);
//   const socketRef = useRef(null);

//   // -------------------------------
//   // Inicializar socket.io
//   // -------------------------------
//   useEffect(() => {
//     socketRef.current = io("http://localhost:4000", { query: { userId: USER_ID } });

//     socketRef.current.on("connect", () => {
//       console.log("🔵 Conectado al socket, ID:", socketRef.current.id);
//     });

//     socketRef.current.on("receive-message", (msg) => {
//       console.log("📩 Mensaje recibido:", msg);

//       // Convertir audio base64 a URL si aplica
//       if (msg.type === "audio" && msg.file) {
//         try {
//           const byteString = atob(msg.file.split(",")[1]);
//           const mimeString = msg.file.split(",")[0].split(":")[1].split(";")[0];
//           const ab = new ArrayBuffer(byteString.length);
//           const ia = new Uint8Array(ab);
//           for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
//           const blob = new Blob([ab], { type: mimeString });
//           msg.audioURL = URL.createObjectURL(blob);
//         } catch (e) {
//           console.error("Error convirtiendo audio:", e);
//         }
//       }

//       if (msg.private) {
//         const otherUser = msg.from === USER_ID ? msg.to : msg.from;
//         setPrivateChats((prev) => {
//           const prevMsgs = prev[otherUser] || [];
//           return { ...prev, [otherUser]: [...prevMsgs, msg] };
//         });
//       } else {
//         setPublicMessages((prev) => [...prev, msg]);
//       }
//     });

//     socketRef.current.on("active-users", (users) => {
//       setActiveUsers(users.filter((u) => u !== USER_ID));
//     });

//     socketRef.current.on("message-seen", ({ from }) => {
//       setPrivateChats((prev) => {
//         const msgs = prev[from]?.map((m) =>
//           m.from === USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [from]: msgs };
//       });
//     });

//     // Mensajes de prueba si no hay nada
//     setPublicMessages([
//       { from: "user-0001", type: "text", message: "Hola mundo" },
//       { from: USER_ID, type: "text", message: "Hola yo" },
//     ]);

//     return () => {
//       socketRef.current.disconnect();
//       console.log("🔴 Desconectado del socket");
//     };
//   }, []);

//   // -------------------------------
//   // Scroll al final
//   // -------------------------------
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser]);

//   // -------------------------------
//   // Enviar texto
//   // -------------------------------
//   const sendText = () => {
//     if (!text.trim()) return;

//     const messagePayload = { type: "text", message: text };
//     if (selectedUser) {
//       socketRef.current.emit("private-message", { to: selectedUser, ...messagePayload });
//     } else {
//       socketRef.current.emit("send-message", messagePayload);
//     }

//     setText("");
//     setShowEmojiPicker(false);
//   };

//   // -------------------------------
//   // Enviar archivo
//   // -------------------------------
//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       const isAudio = file.type.startsWith("audio/");
//       const payload = {
//         file: reader.result,
//         fileName: file.name,
//         fileType: file.type,
//         type: isAudio ? "audio" : "file",
//       };

//       if (selectedUser) {
//         socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//       } else {
//         socketRef.current.emit("send-file", payload);
//       }
//     };
//     reader.readAsDataURL(file);
//   };

//   // -------------------------------
//   // Audio grabación
//   // -------------------------------
//   const startRecording = async () => {
//     if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
//       alert("Tu navegador no soporta grabación de audio");
//       return;
//     }

//     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     const recorder = new MediaRecorder(stream);
//     const chunks = [];

//     recorder.ondataavailable = (e) => chunks.push(e.data);
//     recorder.onstop = () => {
//       const blob = new Blob(chunks, { type: "audio/webm" });
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         const payload = {
//           file: reader.result,
//           fileName: `audio-${Date.now()}.webm`,
//           fileType: blob.type,
//           type: "audio",
//         };

//         if (selectedUser) {
//           socketRef.current.emit("private-file", { ...payload, to: selectedUser });
//         } else {
//           socketRef.current.emit("send-file", payload);
//         }
//       };
//       reader.readAsDataURL(blob);
//     };

//     recorder.start();
//     setMediaRecorder(recorder);
//     setRecording(true);
//   };

//   const stopRecording = () => {
//     if (mediaRecorder) {
//       mediaRecorder.stop();
//       setRecording(false);
//     }
//   };

//   // -------------------------------
//   // Emoji
//   // -------------------------------
//   const onEmojiClick = (emojiObject) => setText((prev) => prev + emojiObject.emoji);

//   const visibleMessages = selectedUser === null ? publicMessages : privateChats[selectedUser] || [];

//   // -------------------------------
//   // Marcar mensajes como vistos
//   // -------------------------------
//   useEffect(() => {
//     if (selectedUser) {
//       socketRef.current.emit("message-seen", { to: selectedUser });
//       setPrivateChats((prev) => {
//         const msgs = prev[selectedUser]?.map((m) =>
//           m.from !== USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [selectedUser]: msgs };
//       });
//     }
//   }, [selectedUser]);

//   // -------------------------------
//   // Render
//   // -------------------------------
//   return (
//     <div className={`${darkMode ? "dark" : ""} flex h-screen overflow-hidden`}>
//       {/* Sidebar usuarios */}
//       <div className="w-64 bg-gray-100 dark:bg-gray-900 p-4 border-r border-gray-300 dark:border-gray-700 overflow-y-auto">
//         <h2 className="text-lg font-semibold mb-3">Usuarios activos</h2>
//         {activeUsers.map((user) => (
//           <div
//             key={user}
//             onClick={() => setSelectedUser(user)}
//             className={`cursor-pointer p-2 rounded hover:bg-green-200 dark:hover:bg-green-700 ${
//               selectedUser === user ? "bg-green-300 dark:bg-green-600" : ""
//             }`}
//           >
//             {user}
//           </div>
//         ))}
//       </div>

//       {/* Chat principal */}
//       <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
//         {/* Header */}
//         <div className="bg-green-500 dark:bg-green-600 text-white px-6 py-4 flex justify-between items-center shadow-md">
//           <h1 className="text-lg font-semibold">
//             {selectedUser ? `Chat con ${selectedUser}` : "Chat Público"}
//           </h1>
//           <span className="text-sm opacity-80">ID: {USER_ID}</span>
//         </div>

//         {/* Mensajes */}
//         <div className="flex-1 overflow-y-auto p-4 space-y-3 md:p-6">
//           {visibleMessages.map((msg, i) => {
//             const isMe = msg.from === USER_ID;
//             return (
//               <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
//                 <div
//                   className={`relative max-w-[80%] sm:max-w-xs p-4 rounded-3xl break-words shadow-lg transform transition-all duration-300 hover:scale-105
//                     ${isMe
//                       ? "bg-green-500 text-white rounded-br-none"
//                       : darkMode
//                       ? "bg-gray-700 text-white rounded-bl-none"
//                       : "bg-yellow-300 text-gray-900 rounded-bl-none"}`}
//                 >
//                   {msg.type === "text" && <p className="pr-10">{msg.message || msg.content}</p>}

//                   {(msg.type === "file" || msg.type === "audio") && (
//                     <div className="pr-10 mt-1">
//                       {msg.type === "audio" && msg.audioURL ? (
//                         <audio controls className="w-full rounded-lg">
//                           <source src={msg.audioURL} type={msg.fileType} />
//                           Tu navegador no soporta audio.
//                         </audio>
//                       ) : msg.fileType?.startsWith("image") ? (
//                         <img src={msg.file} alt={msg.fileName} className="rounded-lg max-h-48 shadow-sm" />
//                       ) : (
//                         <a
//                           href={msg.file}
//                           download={msg.fileName}
//                           className={`underline ${isMe ? "text-white" : darkMode ? "text-blue-300" : "text-blue-700"}`}
//                         >
//                           📎 {msg.fileName}
//                         </a>
//                       )}
//                     </div>
//                   )}

//                   {isMe && selectedUser && (
//                     <span className="absolute bottom-1 right-2 text-xs opacity-70">
//                       {msg.seen ? "✔✔" : "✔"}
//                     </span>
//                   )}
//                   {!isMe && (
//                     <span className="absolute bottom-1 left-2 text-xs opacity-50">
//                       {msg.from.slice(0, 5)}
//                     </span>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//           <div ref={bottomRef}></div>
//         </div>

//         {showEmojiPicker && (
//           <div className="absolute bottom-20 right-4 z-50">
//             <Picker onEmojiClick={onEmojiClick} theme={darkMode ? "dark" : "light"} />
//           </div>
//         )}

//         {/* Input */}
//         <div className="p-3 flex items-center gap-3 shadow-lg fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-white dark:bg-gray-900 transition-colors duration-300">
//           <button
//             onClick={() => fileInputRef.current.click()}
//             className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 shadow-lg"
//           >
//             <Paperclip className="stroke-gray-950" />
//           </button>
//           <input type="file" hidden ref={fileInputRef} onChange={sendFile} />

//           <input
//             className={`flex-1 rounded-full px-5 py-3 focus:outline-none border ${
//               darkMode
//                 ? "bg-gray-700 text-white border-gray-600 focus:border-green-500"
//                 : "bg-gray-100 text-gray-900 border-gray-300 focus:border-green-500"
//             } transition-all duration-300 shadow-inner`}
//             placeholder="Escribe un mensaje..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && sendText()}
//           />

//           <button
//             onClick={() => setShowEmojiPicker((prev) => !prev)}
//             className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 shadow-lg"
//           >
//             😃
//           </button>

//           {!recording ? (
//             <button
//               onClick={startRecording}
//               className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-lg"
//             >
//               <Mic />
//             </button>
//           ) : (
//             <button
//               onClick={stopRecording}
//               className="p-3 rounded-full bg-gray-700 hover:bg-gray-800 transition-all duration-300 shadow-lg"
//             >
//               <StopCircle />
//             </button>
//           )}

//           <button
//             onClick={sendText}
//             className="bg-green-500 text-white px-5 py-3 rounded-full hover:bg-green-600 transition-all duration-300 shadow-lg"
//           >
//             <SendHorizontal />
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }










// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";
// import Picker from "emoji-picker-react";
// import { SendHorizontal, Paperclip } from "lucide-react";
// const USER_ID = "user-" + Math.floor(Math.random() * 9999);
// let socket;

// export default function ChatPage() {
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);
//   const [darkMode, setDarkMode] = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);

//   useEffect(() => {
//     socket = io("http://localhost:4000", { query: { userId: USER_ID } });

//     socket.on("receive-message", (msg) => {
//       if (msg.private) {
//         const otherUser = msg.from === USER_ID ? msg.to : msg.from;
//         setPrivateChats((prev) => {
//           const prevMsgs = prev[otherUser] || [];
//           if (msg.from === USER_ID && msg.seen === undefined) msg.seen = false;
//           return { ...prev, [otherUser]: [...prevMsgs, msg] };
//         });
//       } else {
//         setPublicMessages((prev) => [...prev, msg]);
//       }
//     });

//     socket.on("active-users", (users) => {
//       setActiveUsers(users.filter((u) => u !== USER_ID));
//     });

//     socket.on("message-seen", ({ from }) => {
//       setPrivateChats((prev) => {
//         const msgs = prev[from]?.map((m) =>
//           m.from === USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [from]: msgs };
//       });
//     });

//     return () => socket.disconnect();
//   }, []);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser]);

//   const sendText = () => {
//     if (!text.trim()) return;
//     if (selectedUser) {
//       socket.emit("private-message", { to: selectedUser, message: text });
//     } else {
//       socket.emit("send-message", text);
//     }
//     setText("");
//     setShowEmojiPicker(false);
//   };

//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onloadend = () => {
//       const payload = { file: reader.result, fileName: file.name, fileType: file.type };
//       if (selectedUser) {
//         socket.emit("private-file", { ...payload, to: selectedUser });
//       } else {
//         socket.emit("send-file", payload);
//       }
//     };
//     reader.readAsDataURL(file);
//   };

//   const onEmojiClick = (emojiObject) => setText((prev) => prev + emojiObject.emoji);

//   const visibleMessages =
//     selectedUser === null ? publicMessages : privateChats[selectedUser] || [];

//   useEffect(() => {
//     if (selectedUser) {
//       socket.emit("message-seen", { to: selectedUser });
//       setPrivateChats((prev) => {
//         const msgs = prev[selectedUser]?.map((m) =>
//           m.from !== USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [selectedUser]: msgs };
//       });
//     }
//   }, [selectedUser]);

//   return (
//     <div className={`${darkMode ? "dark" : ""} flex h-screen overflow-hidden`}>
//       {/* Sidebar */}
//       <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 shadow-lg
//         ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:flex flex-col`}>
//         <h2 className="px-6 py-5 font-bold text-xl border-b border-gray-200 dark:border-gray-700">Usuarios Activos</h2>

//         <button
//           onClick={() => { setSelectedUser(null); setSidebarOpen(false); }}
//           className={`w-full text-left p-4 my-1 hover:bg-yellow-400 transition-all duration-300 rounded-xl ${selectedUser === null ? "bg-green-500 text-white shadow-lg" : ""}`}
//         >
//           🌍 Chat Público
//         </button>

//         <ul className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
//           {activeUsers.map((user) => (
//             <li
//               key={user}
//               onClick={() => { setSelectedUser(user); setSidebarOpen(false); }}
//               className={`p-4 cursor-pointer hover:bg-yellow-400 transition-all duration-300 rounded-xl ${selectedUser === user ? "bg-green-500 text-white shadow-lg" : ""}`}
//             >
//               👤 {user}
//             </li>
//           ))}
//           {activeUsers.length === 0 && <li className="p-4 text-gray-400 dark:text-gray-500 text-sm">Nadie conectado</li>}
//         </ul>

//         <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
//           <span className="text-gray-700 dark:text-gray-300">Modo oscuro</span>
//           <input type="checkbox" checked={darkMode} onChange={() => setDarkMode(!darkMode)} className="cursor-pointer" />
//         </div>
//       </div>

//       {/* Botón para abrir sidebar en móvil */}
//       <button
//         className="fixed top-4 left-4 z-50 md:hidden p-3 bg-green-500 text-white rounded-full shadow-lg"
//         onClick={() => setSidebarOpen(true)}
//       >
//         ☰
//       </button>

//       {/* Chat */}
//       <div className="flex-1 flex flex-col md:ml-64 bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
//         {/* Header */}
//         <div className="bg-green-500 dark:bg-green-600 text-white px-6 py-4 flex justify-between items-center shadow-md">
//           <h1 className="text-lg font-semibold">{selectedUser ? `Chat con ${selectedUser}` : "Chat Público"}</h1>
//           <span className="text-sm opacity-80">ID: {USER_ID}</span>
//         </div>

//         {/* Mensajes */}
//         <div className="flex-1 overflow-y-auto p-4 space-y-3 md:p-6 bg-gray-50">
//           {visibleMessages.map((msg, i) => {
//             const isMe = msg.from === USER_ID;
//             return (
//               <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
//                 <div
//                   className={`relative max-w-[80%] sm:max-w-xs p-4 rounded-3xl break-words shadow-lg transform transition-all duration-300 hover:scale-105
//                     ${isMe
//                       ? "bg-green-500 text-white rounded-br-none"
//                       : darkMode
//                         ? "bg-gray-700 text-white rounded-bl-none"
//                         : "bg-yellow-300 text-gray-900 rounded-bl-none"}`}
//                 >
//                   {msg.type === "text" && <p className="pr-10">{msg.message || msg.content}</p>}
//                   {msg.type === "file" && (
//                     <div className="pr-10 mt-1">
//                       {msg.fileType?.startsWith("image") ? (
//                         <img src={msg.file} alt={msg.fileName} className="rounded-lg max-h-48 shadow-sm" />
//                       ) : (
//                         <a
//                           href={msg.file}
//                           download={msg.fileName}
//                           className={`underline ${isMe ? "text-white" : darkMode ? "text-blue-300" : "text-blue-700"}`}
//                         >
//                           📎 {msg.fileName}
//                         </a>
//                       )}
//                     </div>
//                   )}

//                   {isMe && selectedUser && (
//                     <span className="absolute bottom-1 right-2 text-xs opacity-70">
//                       {msg.seen ? "✔✔" : "✔"}
//                     </span>
//                   )}
//                   {!isMe && (
//                     <span className="absolute bottom-1 left-2 text-xs opacity-50">
//                       {msg.from.slice(0, 5)}
//                     </span>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//           <div ref={bottomRef}></div>
//         </div>

//         {showEmojiPicker && (
//           <div className="absolute bottom-20 right-4 z-50">
//             <Picker onEmojiClick={onEmojiClick} theme={darkMode ? "dark" : "light"} />
//           </div>
//         )}

//         {/* Input fijo en móvil */}
//         <div className="p-3 flex items-center gap-3 shadow-lg fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-white dark:bg-gray-900 transition-colors duration-300">
//           <button
//             onClick={() => fileInputRef.current.click()}
//             className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 shadow-lg"
//           >
//             <Paperclip absoluteStrokeWidth  className="stroke-gray-950"/>
//           </button>
//           <input type="file" hidden ref={fileInputRef} onChange={sendFile} />

//           <input
//             className={`flex-1 rounded-full px-5 py-3 focus:outline-none border ${darkMode ? "bg-gray-700 text-white border-gray-600 focus:border-green-500" : "bg-gray-100 text-gray-900 border-gray-300 focus:border-green-500"} transition-all duration-300 shadow-inner`}
//             placeholder="Escribe un mensaje..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && sendText()}
//           />

//           <button
//             onClick={() => setShowEmojiPicker((prev) => !prev)}
//             className="p-3 rounded-full bg-yellow-400 hover:bg-yellow-300 transition-all duration-300 shadow-lg"
//           >
//             😃
//           </button>

//           <button
//             onClick={sendText}
//             className="bg-green-500 text-white px-5 py-3 rounded-full hover:bg-green-600 transition-all duration-300 shadow-lg"
//           >
//             <SendHorizontal />
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }






//FUNCIONAL DOS CHECKS VISTO WHATSAPP + EMOJIS + MEJORAS UI
// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";
// import Picker from "emoji-picker-react";

// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// let socket;

// export default function ChatPage() {
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);

//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);

//   useEffect(() => {
//     socket = io("http://localhost:4000", { query: { userId: USER_ID } });

//     socket.on("receive-message", (msg) => {
//       if (msg.private) {
//         const otherUser = msg.from === USER_ID ? msg.to : msg.from;
//         setPrivateChats((prev) => {
//           const prevMsgs = prev[otherUser] || [];
//           // Si es tu mensaje recién enviado desde el server, agrega 'seen' como false
//           if (msg.from === USER_ID && msg.seen === undefined) msg.seen = false;
//           return { ...prev, [otherUser]: [...prevMsgs, msg] };
//         });
//       } else {
//         setPublicMessages((prev) => [...prev, msg]);
//       }
//     });

//     socket.on("active-users", (users) => {
//       setActiveUsers(users.filter((u) => u !== USER_ID));
//     });

//     socket.on("message-seen", ({ from }) => {
//       setPrivateChats((prev) => {
//         const msgs = prev[from]?.map((m) =>
//           m.from === USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [from]: msgs };
//       });
//     });

//     return () => socket.disconnect();
//   }, []);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser]);

//   const sendText = () => {
//     if (!text.trim()) return;

//     if (selectedUser) {
//       socket.emit("private-message", { to: selectedUser, message: text });
//       // No agregamos manualmente el mensaje, el socket lo retornará
//     } else {
//       socket.emit("send-message", text);
//     }

//     setText("");
//     setShowEmojiPicker(false);
//   };

//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       const payload = { file: reader.result, fileName: file.name, fileType: file.type };
//       if (selectedUser) {
//         socket.emit("private-file", { ...payload, to: selectedUser });
//       } else {
//         socket.emit("send-file", payload);
//       }
//     };
//     reader.readAsDataURL(file);
//   };

//   const onEmojiClick = (emojiObject) => {
//     setText((prev) => prev + emojiObject.emoji);
//   };

//   const visibleMessages =
//     selectedUser === null ? publicMessages : privateChats[selectedUser] || [];

//   // Marcar mensajes como vistos al abrir chat privado
//   useEffect(() => {
//     if (selectedUser) {
//       socket.emit("message-seen", { to: selectedUser });
//       setPrivateChats((prev) => {
//         const msgs = prev[selectedUser]?.map((m) =>
//           m.from !== USER_ID ? { ...m, seen: true } : m
//         );
//         return { ...prev, [selectedUser]: msgs };
//       });
//     }
//   }, [selectedUser]);

//   return (
//     <div className="flex h-screen bg-gray-100">
//       {/* Sidebar */}
//       <div className="w-64 bg-white border-r shadow flex flex-col">
//         <h2 className="px-4 py-4 font-semibold text-lg border-b">Usuarios Activos</h2>

//         <button
//           onClick={() => setSelectedUser(null)}
//           className={`w-full text-left p-3 hover:bg-gray-100 ${
//             selectedUser === null ? "bg-blue-100" : ""
//           }`}
//         >
//           🌍 Chat Público
//         </button>

//         <ul className="flex-1 divide-y overflow-y-auto">
//           {activeUsers.map((user) => (
//             <li
//               key={user}
//               onClick={() => setSelectedUser(user)}
//               className={`p-3 cursor-pointer hover:bg-gray-100 ${
//                 selectedUser === user ? "bg-blue-100" : ""
//               }`}
//             >
//               👤 {user}
//             </li>
//           ))}
//           {activeUsers.length === 0 && (
//             <li className="p-3 text-gray-500 text-sm">Nadie conectado</li>
//           )}
//         </ul>
//       </div>

//       {/* Chat */}
//       <div className="flex-1 flex flex-col">
//         {/* Header */}
//         <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center shadow">
//           <h1 className="text-lg font-semibold">
//             {selectedUser ? `Chat privado con ${selectedUser}` : "Chat Público"}
//           </h1>
//           <span className="text-sm opacity-80">ID: {USER_ID}</span>
//         </div>

//         {/* Mensajes */}
//         <div className="flex-1 overflow-y-auto p-4 space-y-2">
//           {visibleMessages.map((msg, i) => {
//             const isMe = msg.from === USER_ID;
//             return (
//               <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
//                 <div
//                   className={`relative max-w-xs p-3 rounded-2xl break-words shadow transform transition duration-300 hover:scale-105 ${
//                     isMe
//                       ? "bg-blue-500 text-white rounded-br-none"
//                       : "bg-gray-200 text-gray-900 rounded-bl-none"
//                   }`}
//                 >
//                   {msg.type === "text" && <p className="pr-10">{msg.message || msg.content}</p>}
//                   {msg.type === "file" && (
//                     <div className="pr-10 mt-1">
//                       {msg.fileType?.startsWith("image") ? (
//                         <img src={msg.file} alt={msg.fileName} className="rounded-lg max-h-48" />
//                       ) : (
//                         <a
//                           href={msg.file}
//                           download={msg.fileName}
//                           className={`underline ${isMe ? "text-white" : "text-blue-700"}`}
//                         >
//                           📎 {msg.fileName}
//                         </a>
//                       )}
//                     </div>
//                   )}

//                   {/* Checks estilo WhatsApp */}
//                   {isMe && selectedUser && (
//                     <span className="absolute bottom-1 right-2 text-xs opacity-70">
//                       {msg.seen ? "✔✔" : "✔"}
//                     </span>
//                   )}

//                   {!isMe && (
//                     <span className="absolute bottom-1 left-2 text-xs opacity-50">
//                       {msg.from.slice(0, 5)}
//                     </span>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//           <div ref={bottomRef}></div>
//         </div>

//         {/* Input */}
//         <div className="p-3 bg-white flex items-center gap-2 shadow relative">
//           <button
//             onClick={() => fileInputRef.current.click()}
//             className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
//           >
//             📎
//           </button>

//           <input type="file" hidden ref={fileInputRef} onChange={sendFile} />

//           <input
//             className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none"
//             placeholder="Escribe un mensaje..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && sendText()}
//           />

//           <button
//             onClick={() => setShowEmojiPicker((prev) => !prev)}
//             className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
//           >
//             😃
//           </button>

//           <button
//             onClick={sendText}
//             className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
//           >
//             Enviar
//           </button>

//           {showEmojiPicker && (
//             <div className="absolute bottom-12 left-3 z-50">
//               <Picker onEmojiClick={onEmojiClick} />
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }



















// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";

// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// let socket;

// export default function ChatPage() {
//   const [publicMessages, setPublicMessages] = useState([]);
//   const [privateChats, setPrivateChats] = useState({});
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");
//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);

//   // ----------------------------
//   // Conexión Socket
//   // ----------------------------
//   useEffect(() => {
//     socket = io("http://localhost:4000", {
//       query: { userId: USER_ID },
//     });

//     socket.on("receive-message", (msg) => {
//       if (msg.private) {
//         const otherUser = msg.from === USER_ID ? msg.to : msg.from;
//         setPrivateChats((prev) => ({
//           ...prev,
//           [otherUser]: [...(prev[otherUser] || []), msg],
//         }));
//       } else {
//         setPublicMessages((prev) => [...prev, msg]);
//       }
//     });

//     socket.on("active-users", (users) => {
//       setActiveUsers(users.filter((u) => u !== USER_ID));
//     });

//     return () => socket.disconnect();
//   }, []);

//   // Auto-scroll
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser]);

//   // ----------------------------
//   // Enviar texto
//   // ----------------------------
//   const sendText = () => {
//     if (!text.trim()) return;

//     if (selectedUser) {
//       socket.emit("private-message", {
//         to: selectedUser,
//         message: text,
//       });
//     } else {
//       socket.emit("send-message", text);
//     }

//     setText("");
//   };

//   // ----------------------------
//   // Enviar archivo
//   // ----------------------------
//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       const payload = {
//         file: reader.result,
//         fileName: file.name,
//         fileType: file.type,
//       };

//       if (selectedUser) {
//         socket.emit("private-file", { ...payload, to: selectedUser });
//       } else {
//         socket.emit("send-file", payload);
//       }
//     };

//     reader.readAsDataURL(file);
//   };

//   // ----------------------------
//   // Mensajes a mostrar
//   // ----------------------------
//   const visibleMessages =
//     selectedUser === null
//       ? publicMessages
//       : privateChats[selectedUser] || [];

//   return (
//     <div className="flex h-screen bg-gray-100">
//       {/* -------------------- */}
//       {/* Lista de usuarios */}
//       {/* -------------------- */}
//       <div className="w-64 bg-white border-r shadow flex flex-col">
//         <h2 className="px-4 py-4 font-semibold text-lg border-b">Usuarios Activos</h2>

//         <button
//           onClick={() => setSelectedUser(null)}
//           className={`w-full text-left p-3 hover:bg-gray-100 ${
//             selectedUser === null ? "bg-blue-100" : ""
//           }`}
//         >
//           🌍 Chat Público
//         </button>

//         <ul className="flex-1 divide-y overflow-y-auto">
//           {activeUsers.map((user) => (
//             <li
//               key={user}
//               onClick={() => setSelectedUser(user)}
//               className={`p-3 cursor-pointer hover:bg-gray-100 ${
//                 selectedUser === user ? "bg-blue-100" : ""
//               }`}
//             >
//               👤 {user}
//             </li>
//           ))}
//           {activeUsers.length === 0 && (
//             <li className="p-3 text-gray-500 text-sm">Nadie conectado</li>
//           )}
//         </ul>
//       </div>

//       {/* -------------------- */}
//       {/* Chat */}
//       {/* -------------------- */}
//       <div className="flex-1 flex flex-col">
//         {/* Header */}
//         <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center shadow">
//           <h1 className="text-lg font-semibold">
//             {selectedUser ? `Chat privado con ${selectedUser}` : "Chat Público"}
//           </h1>
//           <span className="text-sm opacity-80">ID: {USER_ID}</span>
//         </div>

//         {/* Mensajes */}
//         <div className="flex-1 overflow-y-auto p-4 space-y-2">
//           {visibleMessages.map((msg, i) => {
//             const isMe = msg.from === USER_ID;
//             return (
//               <div
//                 key={i}
//                 className={`flex ${isMe ? "justify-end" : "justify-start"}`}
//               >
//                 <div
//                   className={`max-w-xs p-3 rounded-2xl break-words shadow ${
//                     isMe
//                       ? "bg-blue-500 text-white rounded-br-none"
//                       : "bg-gray-200 text-gray-900 rounded-bl-none"
//                   }`}
//                 >
//                   {msg.type === "text" && <p>{msg.content}</p>}

//                   {msg.type === "file" && (
//                     <div>
//                       {msg.fileType?.startsWith("image") ? (
//                         <img
//                           src={msg.file}
//                           alt={msg.fileName}
//                           className="rounded-lg max-h-48 mt-1"
//                         />
//                       ) : (
//                         <a
//                           href={msg.file}
//                           download={msg.fileName}
//                           className="underline text-blue-700"
//                         >
//                           📎 {msg.fileName}
//                         </a>
//                       )}
//                     </div>
//                   )}

//                   <span className="block text-xs mt-1 opacity-70 text-right">
//                     {msg.from.slice(0, 5)}
//                   </span>
//                 </div>
//               </div>
//             );
//           })}
//           <div ref={bottomRef}></div>
//         </div>

//         {/* Input */}
//         <div className="p-3 bg-white flex items-center gap-3 shadow">
//           <button
//             onClick={() => fileInputRef.current.click()}
//             className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
//           >
//             📎
//           </button>

//           <input type="file" hidden ref={fileInputRef} onChange={sendFile} />

//           <input
//             className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none"
//             placeholder="Escribe un mensaje..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && sendText()}
//           />

//           <button
//             onClick={sendText}
//             className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
//           >
//             Enviar
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }



















// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";

// const USER_ID = "user-" + Math.floor(Math.random() * 9999);

// let socket;

// export default function ChatPage() {
//   // MENSAJES PUBLICOS
//   const [publicMessages, setPublicMessages] = useState([]);

//   // CHATS PRIVADOS { userId: [msgs] }
//   const [privateChats, setPrivateChats] = useState({});

//   // UI
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null);
//   const [text, setText] = useState("");

//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);

//   // ------------------------------------------------------
//   //                CONEXIÓN SOCKET
//   // ------------------------------------------------------
//   useEffect(() => {
//     socket = io("http://localhost:4000", {
//       query: { userId: USER_ID },
//     });

//     // Recibir mensajes
//     socket.on("receive-message", (msg) => {
//       // --------------------------------
//       //          PRIVADO
//       // --------------------------------
//       if (msg.private) {
//         setPrivateChats((prev) => ({
//           ...prev,
//           [msg.from === USER_ID ? msg.to : msg.from]: [
//             ...(prev[msg.from === USER_ID ? msg.to : msg.from] || []),
//             msg,
//           ],
//         }));
//       }

//       // --------------------------------
//       //          PUBLICO
//       // --------------------------------
//       if (!msg.private) {
//         setPublicMessages((prev) => [...prev, msg]);
//       }
//     });

//     // Usuarios activos
//     socket.on("active-users", (users) => {
//       setActiveUsers(users.filter((u) => u !== USER_ID));
//     });

//     return () => socket.disconnect();
//   }, []);

//   // Auto-scroll
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [publicMessages, privateChats, selectedUser]);

//   // ------------------------------------------------------
//   //                ENVIAR TEXTO
//   // ------------------------------------------------------
//   const sendText = () => {
//     if (!text.trim()) return;

//     if (selectedUser) {
//       socket.emit("private-message", {
//         to: selectedUser,
//         message: text,
//       });

//       // Agregar a tu propio chat
//       setPrivateChats((prev) => ({
//         ...prev,
//         [selectedUser]: [
//           ...(prev[selectedUser] || []),
//           {
//             from: USER_ID,
//             to: selectedUser,
//             content: text,
//             private: true,
//             type: "text",
//           },
//         ],
//       }));
//     } else {
//       socket.emit("send-message", text);
//     }

//     setText("");
//   };

//   // ------------------------------------------------------
//   //                ENVIAR ARCHIVO
//   // ------------------------------------------------------
//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();

//     reader.onloadend = () => {
//       const payload = {
//         file: reader.result,
//         fileName: file.name,
//         fileType: file.type,
//       };

//       if (selectedUser) {
//         socket.emit("private-file", {
//           ...payload,
//           to: selectedUser,
//         });

//         // Agregar local
//         setPrivateChats((prev) => ({
//           ...prev,
//           [selectedUser]: [
//             ...(prev[selectedUser] || []),
//             {
//               from: USER_ID,
//               to: selectedUser,
//               private: true,
//               type: "file",
//               ...payload,
//             },
//           ],
//         }));
//       } else {
//         socket.emit("send-file", payload);
//       }
//     };

//     reader.readAsDataURL(file);
//   };

//   // ------------------------------------------------------
//   //                MENSAJES VISIBLES
//   // ------------------------------------------------------
//   const visibleMessages =
//     selectedUser === null
//       ? publicMessages
//       : privateChats[selectedUser] || [];

//   return (
//     <div className="flex h-screen bg-gray-100">

//       {/* ------------------------------ */}
//       {/*   LISTA DE USUARIOS            */}
//       {/* ------------------------------ */}
//       <div className="w-64 bg-white border-r shadow">
//         <h2 className="px-4 py-4 font-semibold text-lg border-b">
//           Usuarios Activos
//         </h2>

//         <button
//           onClick={() => setSelectedUser(null)}
//           className={`w-full p-3 text-left ${
//             selectedUser === null ? "bg-blue-100" : ""
//           }`}
//         >
//           🌍 Chat Público
//         </button>

//         <ul className="divide-y">
//           {activeUsers.map((user) => (
//             <li
//               key={user}
//               onClick={() => setSelectedUser(user)}
//               className={`p-3 cursor-pointer hover:bg-gray-100 ${
//                 selectedUser === user ? "bg-blue-100" : ""
//               }`}
//             >
//               👤 {user}
//             </li>
//           ))}
//         </ul>
//       </div>

//       {/* ------------------------------ */}
//       {/*   CHAT                         */}
//       {/* ------------------------------ */}
//       <div className="flex-1 flex flex-col">
//         {/* Header */}
//         <div className="bg-blue-600 text-white px-4 py-3 flex justify-between">
//           <h1 className="text-lg font-semibold">
//             {selectedUser
//               ? `Chat privado con ${selectedUser}`
//               : "Chat Público"}
//           </h1>
//           <span className="text-sm opacity-80">ID: {USER_ID}</span>
//         </div>

//         {/* Mensajes */}
//         <div className="flex-1 overflow-y-auto p-4 space-y-4">
//           {visibleMessages.map((msg, i) => (
//             <div
//               key={i}
//               className={`max-w-xs p-3 rounded-xl shadow bg-white ${
//                 msg.from === USER_ID ? "ml-auto bg-blue-100" : ""
//               }`}
//             >
//               {msg.type === "text" && (
//                 <p className="text-gray-900">{msg.content}</p>
//               )}

//               {msg.type === "file" && (
//                 <div>
//                   {msg.fileType?.startsWith("image") ? (
//                     <img
//                       src={msg.file}
//                       className="rounded-lg max-h-48"
//                       alt="file"
//                     />
//                   ) : (
//                     <a
//                       href={msg.file}
//                       download={msg.fileName}
//                       className="text-blue-600 underline"
//                     >
//                       📎 Descargar {msg.fileName}
//                     </a>
//                   )}
//                 </div>
//               )}

//               <p className="text-xs mt-1 text-gray-500">
//                 {msg.from.slice(0, 5)}
//               </p>
//             </div>
//           ))}

//           <div ref={bottomRef}></div>
//         </div>

//         {/* Input */}
//         <div className="p-3 bg-white flex items-center gap-3 shadow">
//           <button
//             onClick={() => fileInputRef.current.click()}
//             className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
//           >
//             📎
//           </button>

//           <input type="file" hidden ref={fileInputRef} onChange={sendFile} />

//           <input
//             className="flex-1 border rounded-full px-4 py-2"
//             placeholder="Escribe un mensaje..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && sendText()}
//           />

//           <button
//             onClick={sendText}
//             className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
//           >
//             Enviar
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }





















// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";

// const USER_ID = "user-" + Math.floor(Math.random() * 9999); // Usar tu ID real

// let socket;

// export default function ChatPage() {
//   const [messages, setMessages] = useState([]);
//   const [activeUsers, setActiveUsers] = useState([]);
//   const [selectedUser, setSelectedUser] = useState(null); // destino privado
//   const [text, setText] = useState("");
//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);

//   // ------------------------------
//   // CONEXIÓN SOCKET
//   // ------------------------------
//   useEffect(() => {
//     socket = io("http://localhost:4000", {
//       query: { userId: USER_ID },
//     });

//     // Recibir mensajes
//     socket.on("receive-message", (msg) => {
//       // Mensajes privados: solo mostrar si soy parte
//       if (msg.private) {
//         if (msg.from === selectedUser || msg.from === USER_ID || msg.to === USER_ID) {
//           setMessages((prev) => [...prev, msg]);
//         }
//       } else {
//         setMessages((prev) => [...prev, msg]);
//       }
//     });

//     // Lista de usuarios activos
//     socket.on("active-users", (users) => {
//       setActiveUsers(users.filter((u) => u !== USER_ID));
//     });

//     return () => socket.disconnect();
//   }, [selectedUser]);

//   // Auto-scroll
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   // ------------------------------
//   // ENVÍO DE MENSAJES
//   // ------------------------------
//   const sendText = () => {
//     if (!text.trim()) return;

//     if (selectedUser) {
//       // PRIVADO
//       socket.emit("private-message", {
//         to: selectedUser,
//         message: text,
//       });
//     } else {
//       // PÚBLICO
//       socket.emit("send-message", text);
//     }

//     setText("");
//   };

//   // ------------------------------
//   // ENVÍO DE ARCHIVOS
//   // ------------------------------
//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       if (selectedUser) {
//         socket.emit("private-file", {
//           to: selectedUser,
//           file: reader.result,
//           fileName: file.name,
//           fileType: file.type,
//         });
//       } else {
//         socket.emit("send-file", {
//           file: reader.result,
//           fileName: file.name,
//           fileType: file.type,
//         });
//       }
//     };

//     reader.readAsDataURL(file);
//   };

//   return (
//     <div className="flex h-screen bg-gray-100">

//       {/* ------------------------- */}
//       {/*  LADO IZQUIERDO: USUARIOS */}
//       {/* ------------------------- */}
//       <div className="w-64 bg-white shadow-lg border-r">
//         <h2 className="px-4 py-4 font-semibold text-lg border-b">
//           Usuarios Activos
//         </h2>

//         <ul className="divide-y">
//           {activeUsers.map((user) => (
//             <li
//               key={user}
//               onClick={() => setSelectedUser(user)}
//               className={`p-3 cursor-pointer hover:bg-gray-100 ${
//                 selectedUser === user ? "bg-blue-50" : ""
//               }`}
//             >
//               <span className="font-medium">👤 {user}</span>
//             </li>
//           ))}

//           {activeUsers.length === 0 && (
//             <p className="p-3 text-gray-500 text-sm">Nadie conectado</p>
//           )}
//         </ul>
//       </div>

//       {/* ------------------------- */}
//       {/*  DERECHA: CHAT */}
//       {/* ------------------------- */}
//       <div className="flex-1 flex flex-col">
//         {/* Header */}
//         <div className="bg-blue-600 text-white px-4 py-3 shadow flex justify-between">
//           <h1 className="text-lg font-semibold">
//             {selectedUser ? `Chat privado con ${selectedUser}` : "Chat público"}
//           </h1>
//           <span className="text-sm opacity-80">Tu ID: {USER_ID}</span>
//         </div>

//         {/* Chat Container */}
//         <div className="flex-1 overflow-y-auto p-4 space-y-4">
//           {messages.map((msg, i) => (
//             <div
//               key={i}
//               className={`max-w-xs p-3 rounded-xl shadow bg-white ${
//                 msg.from === USER_ID ? "ml-auto bg-blue-100" : ""
//               }`}
//             >
//               {msg.type === "text" && (
//                 <p className="text-gray-800">{msg.content}</p>
//               )}

//               {msg.type === "file" && (
//                 <div>
//                   {msg.fileType.startsWith("image") ? (
//                     <img
//                       src={msg.file}
//                       alt={msg.fileName}
//                       className="rounded-lg max-h-48"
//                     />
//                   ) : (
//                     <a
//                       href={msg.file}
//                       download={msg.fileName}
//                       className="text-blue-600 underline"
//                     >
//                       Descargar: {msg.fileName}
//                     </a>
//                   )}
//                 </div>
//               )}

//               <span className="block text-xs mt-1 text-gray-500">
//                 {msg.from?.slice(0, 5)}
//               </span>
//             </div>
//           ))}

//           <div ref={bottomRef}></div>
//         </div>

//         {/* Input */}
//         <div className="p-3 bg-white flex items-center gap-3 shadow">
//           <button
//             onClick={() => fileInputRef.current.click()}
//             className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
//           >
//             📎
//           </button>

//           <input ref={fileInputRef} type="file" hidden onChange={sendFile} />

//           <input
//             className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none"
//             placeholder="Escribe un mensaje..."
//             value={text}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && sendText()}
//           />

//           <button
//             onClick={sendText}
//             className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
//           >
//             Enviar
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


























// "use client";

// import { useEffect, useRef, useState } from "react";
// import { io } from "socket.io-client";

// let socket;

// export default function ChatPage() {
//   const [messages, setMessages] = useState([]);
//   const [text, setText] = useState("");
//   const fileInputRef = useRef(null);
//   const bottomRef = useRef(null);

//   useEffect(() => {
//     socket = io("http://localhost:4000");

//     socket.on("receive-message", (msg) => {
//       setMessages((prev) => [...prev, msg]);
//     });

//     return () => socket.disconnect();
//   }, []);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   const sendText = () => {
//     if (!text.trim()) return;
//     socket.emit("send-message", text);
//     setText("");
//   };

//   const sendFile = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       socket.emit("send-file", {
//         file: reader.result,
//         fileName: file.name,
//         fileType: file.type,
//       });
//     };

//     reader.readAsDataURL(file);
//   };

//   return (
//     <div className="flex flex-col h-screen bg-gray-100">
//       {/* Header */}
//       <div className="bg-blue-600 text-white px-4 py-3 shadow">
//         <h1 className="text-lg font-semibold">Chat en tiempo real</h1>
//       </div>

//       {/* Chat Container */}
//       <div className="flex-1 overflow-y-auto p-4 space-y-4">
//         {messages.map((msg, i) => (
//           <div
//             key={i}
//             className={`max-w-xs p-3 rounded-xl shadow bg-white ${
//               msg.id === socket.id ? "ml-auto bg-blue-100" : ""
//             }`}
//           >
//             {msg.type === "text" && (
//               <p className="text-gray-800">{msg.content}</p>
//             )}

//             {msg.type === "file" && (
//               <div>
//                 {msg.fileType.startsWith("image") ? (
//                   <img
//                     src={msg.file}
//                     alt={msg.fileName}
//                     className="rounded-lg max-h-48"
//                   />
//                 ) : (
//                   <a
//                     href={msg.file}
//                     download={msg.fileName}
//                     className="text-blue-600 underline"
//                   >
//                     Descargar archivo: {msg.fileName}
//                   </a>
//                 )}
//               </div>
//             )}

//             <span className="block text-xs mt-1 text-gray-500">
//               {msg.id.slice(0, 5)}
//             </span>
//           </div>
//         ))}

//         <div ref={bottomRef}></div>
//       </div>

//       {/* Input */}
//       <div className="p-3 bg-white flex items-center gap-3 shadow">
//         <button
//           onClick={() => fileInputRef.current.click()}
//           className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
//         >
//           📎
//         </button>

//         <input
//           ref={fileInputRef}
//           type="file"
//           hidden
//           onChange={sendFile}
//         />

//         <input
//           className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none"
//           placeholder="Escribe un mensaje..."
//           value={text}
//           onChange={(e) => setText(e.target.value)}
//           onKeyDown={(e) => e.key === "Enter" && sendText()}
//         />

//         <button
//           onClick={sendText}
//           className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
//         >
//           Enviar
//         </button>
//       </div>
//     </div>
//   );
// }
