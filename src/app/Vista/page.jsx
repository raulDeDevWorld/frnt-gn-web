





//fUNCIONAL 2

"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import Picker from "emoji-picker-react";
import { 
    SendHorizontal, Paperclip, Mic, StopCircle, Play, Pause, 
    Trash2, Menu, ArrowLeft, Settings, Volume2, Smile
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

const getAudioURLFromBase64 = (base64Data, fileType) => {
  if (!base64Data || typeof base64Data !== 'string') return "";
  const type = fileType || "audio/webm";
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

const USER_ID = "user-" + Math.floor(Math.random() * 9999);


// ------------------------------------------------------------------
// --- 2. Componentes Separados (Anidados) ---
// ------------------------------------------------------------------

// Audio Player Component (Usado en MessageBubble)
const AudioMessagePlayer = ({ audioURL, duration, isMe }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration || 0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoadedMetadata = () => { setAudioDuration(audio.duration); };
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onEnded = () => { setIsPlaying(false); setCurrentTime(0); audio.currentTime = 0; };
        
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        
        return () => {
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
        };
    }, [audioURL]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };
    
    const progressPercentage = (currentTime / (audioDuration || 1)) * 100;
    const barColor = isMe ? "bg-white" : "bg-green-500";
    const trackColor = isMe ? "bg-white/50" : "bg-gray-400/50 dark:bg-gray-500/50";
    const timeColor = isMe ? "text-white/80" : "text-gray-600 dark:text-gray-300";

    return (
        <div className={`flex items-center gap-2 p-2 rounded-lg min-w-[200px] ${isMe ? 'bg-black/10' : 'bg-green-100 dark:bg-green-700/50'} transition-colors`}>
            <button onClick={togglePlay} className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isMe ? 'bg-white text-green-500' : 'bg-green-500 text-white'}`}>
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            
            <div className="flex-1 flex flex-col justify-center">
                <div className={`w-full h-1 rounded-full ${trackColor} cursor-pointer`} onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const newTime = (clickX / rect.width) * audioDuration;
                    audioRef.current.currentTime = newTime;
                    setCurrentTime(newTime);
                }}>
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progressPercentage}%` }} />
                </div>
                <div className="flex justify-between text-[10px] mt-1 font-mono">
                    <span className={timeColor}>{formatTime(currentTime)}</span>
                    <span className={timeColor}>{formatTime(audioDuration)}</span>
                </div>
            </div>

            <audio ref={audioRef} src={audioURL} className="hidden" />
        </div>
    );
};

// File/Image Message Renderer (Usado en MessageBubble)
const FileMessageRenderer = ({ msg, isMe }) => {
    const iconColor = isMe ? "text-white" : "text-green-600 dark:text-green-400";
    const bgColor = isMe ? "bg-black/10" : "bg-gray-200 dark:bg-gray-700";

    if (msg.type === "image") {
        return <img src={`data:${msg.fileType};base64,${msg.file}`} alt="img" className="rounded-lg max-h-64 object-cover w-full cursor-pointer transition-transform hover:scale-[1.01]" />;
    }

    // Default file (document, video, etc.)
    return (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${bgColor} transition-colors`}>
            <div className={`p-2 rounded-full ${isMe ? 'bg-white/20' : 'bg-green-100 dark:bg-gray-600'}`}>
                <Paperclip className={`h-5 w-5 transform -rotate-45 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
                <a href={`data:${msg.fileType};base64,${msg.file}`} download={msg.fileName} className={`font-medium text-sm truncate block ${isMe ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {msg.fileName}
                </a>
                <span className="text-xs opacity-75">{msg.fileType}</span>
            </div>
        </div>
    );
};


// Message Bubble Component
function MessageBubble({ msg, USER_ID, formatTime }) {
    const isMe = msg.from === USER_ID;
    
    const bubbleClasses = `
        max-w-[80%] p-2 rounded-xl shadow-md break-words 
        ${isMe 
            ? "ml-auto bg-green-500 text-white rounded-br-sm transition-colors duration-200" 
            : "mr-auto bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm transition-colors duration-200"
        }
    `;
    const timeClasses = `text-right text-[10px] mt-1 ${isMe ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`;
    const seenIcon = msg.private && isMe ? (msg.seen ? '✓✓' : '✓') : '';
    
    return (
        <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
            <div className={bubbleClasses}>
                {!isMe && msg.private === false && (
                    <p className="font-bold text-xs mb-1 -mt-0.5" style={{ color: `hsl(${((msg.from.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 10) % 360)}, 60%, 50%)` }}>
                        {msg.from}
                    </p>
                )}
                
                {msg.type === "text" && <p className="text-sm px-1 pt-1 pb-2">{msg.content}</p>}
                
                {msg.type === "audio" && msg.audioURL && (
                    <AudioMessagePlayer audioURL={msg.audioURL} duration={msg.duration} isMe={isMe} />
                )}
                
                {(msg.type === "image" || msg.type === "file") && (
                    <FileMessageRenderer msg={msg} isMe={isMe} />
                )}
                
                <div className={timeClasses}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                    {seenIcon && <span className={`ml-1 ${msg.seen ? 'text-blue-200 dark:text-blue-300' : 'text-white/70 dark:text-gray-400'}`}>{seenIcon}</span>}
                </div>
            </div>
        </div>
    );
}

// Sidebar Component
function ChatSidebar({ 
    darkMode, selectedUser, activeUsers, publicMessagesCount, 
    privateChats, setSelectedUser, setDarkMode, USER_ID, sidebarOpen 
}) {
    return (
        <div className={`
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            fixed inset-y-0 left-0 z-50 
            w-full flex-col 
            md:translate-x-0 md:static md:flex md:w-[35%] lg:w-[30%] 
            border-r border-gray-200 dark:border-gray-700 
            bg-white dark:bg-gray-800 transition-transform duration-300
        `}>
            <div className="p-4 bg-green-500 text-white flex items-center justify-between shadow-md">
                <h2 className="font-bold text-lg">ChatApp <span className="text-sm opacity-75 hidden md:inline">({USER_ID})</span></h2>
                <button onClick={() => setDarkMode(!darkMode)} className="text-white p-2 rounded-full hover:bg-white/20 transition-colors">
                    {darkMode ? '☀️' : '🌙'}
                </button>
            </div>
            
            <div className="p-2 overflow-y-auto flex-1">
                {/* Chat Público */}
                <button 
                    onClick={() => setSelectedUser(null)} 
                    className={`w-full text-left p-3 my-1 rounded-lg flex items-center gap-3 transition-colors duration-200 ${selectedUser === null ? "bg-green-500 text-white shadow-md transform scale-[1.01]" : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"}`}
                >
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${selectedUser === null ? "bg-white text-green-500" : "bg-green-500 text-white"}`}>🌍</span>
                    <div className="flex flex-col">
                        <span className="font-semibold">Chat Público</span>
                        <span className="text-xs opacity-75">{publicMessagesCount} mensajes</span>
                    </div>
                </button>
                
                <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3">Usuarios Activos ({activeUsers.length})</p>
                </div>

                {/* Chats Privados */}
                <ul className="space-y-1">
                    {activeUsers.map(u => {
                        const hasUnseen = privateChats[u]?.some(m => m.from === u && !m.seen);
                        const lastMsg = privateChats[u]?.[privateChats[u].length - 1];
                        
                        return (
                            <li key={u} onClick={() => setSelectedUser(u)} className={`p-3 cursor-pointer rounded-lg flex items-center gap-3 transition-colors duration-200 ${selectedUser === u ? "bg-green-500 text-white shadow-md transform scale-[1.01]" : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"}`}>
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${selectedUser === u ? "bg-white text-green-500" : "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200"}`}>👤</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold truncate">{u}</span>
                                        {lastMsg && <span className={`text-xs ${selectedUser === u ? 'text-white/70' : 'text-gray-400'}`}>{new Date(lastMsg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                                    </div>
                                    <div className="flex justify-between items-center mt-0.5">
                                        <span className={`text-sm truncate ${selectedUser === u ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>{lastMsg?.type === 'text' ? lastMsg.content : lastMsg?.type === 'audio' ? '🎤 Audio' : lastMsg?.type === 'image' ? '🖼️ Imagen' : lastMsg ? '📄 Archivo' : 'En línea'}</span>
                                        {hasUnseen && (
                                            <span className="text-xs font-bold bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                                                {privateChats[u].filter(m => m.from === u && !m.seen).length}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

// Chat Header Component
function ChatHeader({ selectedUser, activeUsers, onBack }) {
    const isPublic = selectedUser === null;
    const subtitle = isPublic ? `${activeUsers.length + 1} participantes` : 'En línea';
    
    return (
        <div className="bg-gray-200 dark:bg-gray-900 px-4 py-3 flex items-center gap-3 shadow-md border-l border-gray-200 dark:border-gray-700 sticky top-0 z-10">
            <button onClick={onBack} className="md:hidden text-green-500 dark:text-green-400 p-1">
                <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500 text-white font-bold text-lg">
                {isPublic ? '🌍' : '👤'}
            </div>
            <div className="flex-1 min-w-0">
                <h1 className="font-semibold truncate text-gray-900 dark:text-white">{isPublic ? "Chat Público" : selectedUser}</h1>
                <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
            </div>
        </div>
    );
}


// Chat Input / Footer Component
function ChatInput({
    text, setText, sendText, showEmojiPicker, setShowEmojiPicker, onEmojiClick, darkMode,
    fileInputRef, handleFileChange, isRecording, startRecording, stopRecording, cancelRecording,
    recordTime, audioFile, recordedDuration, sendAudioMessage, audioDevices, selectedDeviceId,
    setSelectedDeviceId, showMicSettings, setShowMicSettings
}) {
    
    // Estado y lógica para el reproductor de la previsualización de audio
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

    useEffect(() => {
        if (!audioFile) return;
        
        const audio = audioRef.current;
        const onPlay = () => setIsPreviewPlaying(true);
        const onPause = () => setIsPreviewPlaying(false);
        const onEnded = () => { setIsPreviewPlaying(false); setCurrentTime(0); audio.currentTime = 0; };
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTimeUpdate);
        
        // Resetear al cargar nuevo audio
        setCurrentTime(0);
        
        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('timeupdate', onTimeUpdate);
        };
    }, [audioFile, recordedDuration]);
    
    const togglePreviewPlay = () => {
        if (audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        }
    };
    
    const handleProgressChange = (event) => {
        if (audioRef.current) {
            const newTime = parseFloat(event.target.value);
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    return (
        <div className="p-2 bg-gray-100 dark:bg-gray-900 border-t dark:border-gray-700 relative">
            
            {showEmojiPicker && (
                <div className="absolute bottom-16 left-0 right-0 z-50">
                    <Picker onEmojiClick={onEmojiClick} theme={darkMode ? 'dark' : 'light'} width="100%" height={300} />
                </div>
            )}
            
            {showMicSettings && (
                <div className="absolute bottom-16 right-2 w-48 bg-white dark:bg-gray-700 shadow-xl border border-gray-200 dark:border-gray-600 rounded p-2 z-50">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Micrófono:</p>
                    <select 
                        className="w-full text-xs p-1 border rounded dark:bg-gray-600 dark:text-white"
                        value={selectedDeviceId}
                        onChange={(e) => { setSelectedDeviceId(e.target.value); setShowMicSettings(false); }}
                    >
                        {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Default"}</option>)}
                    </select>
                </div>
            )}
            
            {/* Previsualización de Grabación */}
            {audioFile && (
                <div className="flex items-center gap-2 w-full p-2 bg-white dark:bg-gray-800 rounded-lg shadow-inner animate-in fade-in">
                    <button onClick={cancelRecording} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors">
                        <Trash2 className="w-5 h-5" />
                    </button>

                    <div className="flex-1 flex items-center gap-3">
                        <button onClick={togglePreviewPlay} className="text-green-500 dark:text-green-400">
                            {isPreviewPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                        </button>
                        
                        <div className="flex-1 flex flex-col w-full">
                            <input
                                type="range"
                                min="0"
                                max={recordedDuration || 0}
                                value={currentTime}
                                step="0.1"
                                onChange={handleProgressChange}
                                className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-green-500 dark:bg-gray-600"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-1">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(recordedDuration)}</span>
                            </div>
                        </div>

                        <audio
                            ref={audioRef}
                            src={audioFile}
                            className="hidden"
                        />
                    </div>

                    <button onClick={sendAudioMessage} className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-md flex-shrink-0 transition-colors">
                        <SendHorizontal className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Grabando */}
            {!audioFile && isRecording && (
                <div className="flex items-center justify-between w-full px-2 py-3">
                    <div className="flex items-center gap-2 text-red-500 dark:text-red-400 font-mono font-bold animate-pulse">
                        <div className="w-3 h-3 bg-red-500 dark:bg-red-400 rounded-full"></div>
                        Grabando: {formatTime(recordTime)}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={cancelRecording} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-colors">
                            <Trash2 className="w-5 h-5" />
                        </button>
                        <button onClick={stopRecording} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg">
                            <StopCircle className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}

            {/* Input de Texto/Botones */}
            {!audioFile && !isRecording && (
                <div className="flex items-end gap-2">
                    <div className="flex-1 flex items-end bg-white dark:bg-gray-800 rounded-full shadow-inner border border-gray-200 dark:border-gray-700 p-1">
                        
                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-yellow-500 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <Smile className="h-6 w-6" />
                        </button>
                        
                        <input 
                            className="flex-1 bg-transparent px-2 py-2 dark:text-white border-none focus:ring-0 focus:outline-none placeholder-gray-500" 
                            placeholder="Escribe un mensaje..." 
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendText()} 
                        />
                        
                        <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <Paperclip className="h-6 w-6 transform -rotate-45" />
                        </button>
                        <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} />
                        
                        <button onClick={() => setShowMicSettings(!showMicSettings)} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <Settings className="h-6 w-6" />
                        </button>
                    </div>
                    
                    {text.trim() ? (
                        <button onClick={sendText} className="p-3 rounded-full bg-green-500 text-white hover:bg-green-600 shadow-lg flex-shrink-0 transition-colors">
                            <SendHorizontal className="h-6 w-6" />
                        </button>
                    ) : (
                        <button onClick={startRecording} className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg flex-shrink-0 transition-colors">
                            <Mic className="h-6 w-6" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}


// ------------------------------------------------------------------
// --- 3. Componente Principal (ChatPage) ---
// ------------------------------------------------------------------

export default function ChatPage() {
    // --- ESTADOS ---
        // Estados de Datos
    const [publicMessages, setPublicMessages] = useState([]);
    const [privateChats, setPrivateChats] = useState({});
    const [activeUsers, setActiveUsers] = useState([]);

       // Estados de UI
    const [selectedUser, setSelectedUser] = useState(null);
    const [text, setText] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true); // true por defecto en desktop

    // --- ESTADOS DE AUDIO ---
    const [audioFile, setAudioFile] = useState(null); 
    const [isRecording, setIsRecording] = useState(false);
    const [recordedDuration, setRecordedDuration] = useState(0);
    const [recordTime, setRecordTime] = useState(0);
    const [audioDevices, setAudioDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("");
    const [showMicSettings, setShowMicSettings] = useState(false);
    const [uiToast, setUiToast] = useState("");

    // --- REFS ---
    const fileInputRef = useRef(null);
    const bottomRef = useRef(null);
    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordTimeRef = useRef(0);
    const toastTimerRef = useRef(null);

    const showToast = useCallback((message) => {
        const text = String(message || "").trim();
        if (!text) return;
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setUiToast(text);
        toastTimerRef.current = setTimeout(() => {
            setUiToast("");
            toastTimerRef.current = null;
        }, 3600);
    }, []);
    
    // -------------------------------
    // Lógica de Conexión y Mensajes
    // -------------------------------

    useEffect(() => {
        socketRef.current = io("http://localhost:4000", { query: { userId: USER_ID } });

        socketRef.current.on("receive-message", (msg) => {
            if (msg.from === USER_ID) return;

            const newMsg = { ...msg };
            if (newMsg.fileType?.startsWith("audio/") && newMsg.file) {
                newMsg.audioURL = getAudioURLFromBase64(newMsg.file, newMsg.fileType);
                newMsg.type = "audio";
            } else if (newMsg.fileType?.startsWith("image/")) {
                newMsg.type = "image";
            } else if (newMsg.file) {
                newMsg.type = "file";
            }
            
            if (newMsg.private) {
                const otherUser = newMsg.from === USER_ID ? newMsg.to : newMsg.from;
                setPrivateChats((prev) => {
                    const msgs = prev[otherUser] || [];
                    return { ...prev, [otherUser]: [...msgs, { ...newMsg }] };
                });
            } else {
                setPublicMessages((prev) => [...prev, { ...newMsg }]);
            }
        });

        socketRef.current.on("active-users", (users) => setActiveUsers(users.filter((u) => u !== USER_ID)));

        // Obtener permisos y lista de micrófonos
        const getMicrophones = async () => {
            try {
                // Pedir permisos y luego enumerar
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop()); 

                const devices = await navigator.mediaDevices.enumerateDevices();
                const inputs = devices.filter(d => d.kind === 'audioinput');
                setAudioDevices(inputs);
                if(inputs.length > 0) {
                    const defaultDevice = inputs.find(d => d.deviceId === 'default') || inputs[0];
                    setSelectedDeviceId(defaultDevice.deviceId);
                }
            } catch(e) {
                console.error("Error permisos micro:", e);
                showToast("No se pudo acceder al microfono");
            }
        };
        getMicrophones();

        return () => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
            }
            socketRef.current && socketRef.current.disconnect();
        };
    }, [showToast]);

    // Scroll al final
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [publicMessages, privateChats, selectedUser, audioFile, isRecording]);

    // Marcar como visto
    useEffect(() => {
        if (selectedUser && socketRef.current) {
            socketRef.current.emit("message-seen", { to: selectedUser });
            setPrivateChats((prev) => {
                const msgs = prev[selectedUser]?.map((m) => m.from !== USER_ID ? { ...m, seen: true } : m);
                return { ...prev, [selectedUser]: msgs };
            });
        }
    }, [selectedUser]);

    // Manejo Responsive de Sidebar
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) { // md breakpoint de Tailwind
                setSidebarOpen(true);
            } else if (selectedUser !== null) {
                setSidebarOpen(false);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [selectedUser]);


    // -------------------------------
    // Lógica de Envío (Incluye Audio)
    // -------------------------------

    const cancelRecording = useCallback(() => {
        setAudioFile(null);
        setIsRecording(false);
        setRecordTime(0);
        setRecordedDuration(0);
        audioChunksRef.current = [];
        if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        }
    }, []);


    const sendFile = useCallback((file, fileName, fileType, duration) => {
        const isAudio = fileType.startsWith("audio/");
        const isImage = fileType.startsWith("image/");
        
        const payload = { file, fileName, fileType, duration };
        
        const localMsg = { 
            ...payload, 
            type: isAudio ? "audio" : isImage ? "image" : "file", 
            from: USER_ID, 
            timestamp: Date.now(), 
            audioURL: isAudio ? getAudioURLFromBase64(file, fileType) : undefined,
            seen: false
        };

        if (selectedUser) {
            socketRef.current.emit("private-file", { ...payload, to: selectedUser });
            setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
        } else {
            socketRef.current.emit("send-file", payload);
            setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
        }
    }, [selectedUser]);


    const sendAudioMessage = useCallback(() => {
        if (!audioChunksRef.current.length || recordedDuration === 0) {
            cancelRecording();
            return;
        }

        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64String = reader.result;
            const base64Pure = base64String.split(',')[1];
            sendFile(base64Pure, `audio-${Date.now()}.${mimeType.split('/')[1] || 'webm'}`, mimeType, recordedDuration);
            cancelRecording();
        };
    }, [recordedDuration, cancelRecording, sendFile]);


    const sendText = useCallback(() => {
        if (!text.trim()) return;
        const message = text.trim();
        const msg = { type: "text", content: message };
        const localMsg = { ...msg, from: USER_ID, timestamp: Date.now() };

        if (selectedUser) {
            socketRef.current.emit("private-message", { to: selectedUser, message });
            setPrivateChats(prev => ({ ...prev, [selectedUser]: [...(prev[selectedUser] || []), { ...localMsg, to: selectedUser, private: true }] }));
        } else {
            socketRef.current.emit("send-message", msg);
            setPublicMessages(prev => [...prev, { ...localMsg, private: false }]);
        }
        setText("");
        setShowEmojiPicker(false);
        cancelRecording();
    }, [text, selectedUser, cancelRecording]);


    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        cancelRecording();

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Pure = reader.result.split(',')[1];
            sendFile(base64Pure, file.name, file.type);
        };
        reader.readAsDataURL(file);
        e.target.value = null;
    };


    // -------------------------------
    // Lógica de Grabación
    // -------------------------------

    const getSupportedMimeType = () => {
        const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
        return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
    };

    const startRecording = async () => {
        try {
            cancelRecording();
            setText("");
            setShowEmojiPicker(false);

            const constraints = { 
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                } 
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const mimeType = getSupportedMimeType();
            const options = mimeType ? { mimeType } : {};

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const finalMimeType = mediaRecorder.mimeType || options.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
                
                if (audioFile) URL.revokeObjectURL(audioFile);
                setAudioFile(URL.createObjectURL(audioBlob));
                setRecordedDuration(recordTimeRef.current);
                
                // Las pistas se detienen aquí, no en `cancelRecording`
                mediaRecorder.stream.getTracks().forEach(track => track.stop()); 
            };

            mediaRecorder.start(1000); 
            setIsRecording(true);
        } catch (error) {
            console.error("Error al iniciar la grabación:", error);
            console.error("No se pudo acceder al micrófono.");
            showToast("No se pudo iniciar la grabacion de audio");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    // Contador de tiempo de grabación
    useEffect(() => {
        let interval;
        if (isRecording) {
            setRecordTime(0);
            recordTimeRef.current = 0;
            interval = setInterval(() => {
                setRecordTime((prev) => {
                    const newVal = prev + 1;
                    recordTimeRef.current = newVal;
                    return newVal;
                });
            }, 1000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isRecording]);

    const visibleMessages = useMemo(() => 
        selectedUser === null ? publicMessages : privateChats[selectedUser] || []
    , [selectedUser, publicMessages, privateChats]);

    return (
        <div className={`${darkMode ? "dark" : ""} flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden`}>
            {/* Contenedor principal de Chat (Estilo WhatsApp) */}
            <div className="flex w-full h-full max-w-screen-xl mx-auto shadow-2xl bg-white dark:bg-gray-800 md:my-4 md:rounded-xl">
                
                {/* -------------------- 1. SIDEBAR (Lista de Chats) -------------------- */}
                <ChatSidebar 
                    darkMode={darkMode}
                    selectedUser={selectedUser}
                    activeUsers={activeUsers}
                    publicMessagesCount={publicMessages.length}
                    privateChats={privateChats}
                    setSelectedUser={(u) => {
                        setSelectedUser(u);
                        if(window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    setDarkMode={setDarkMode}
                    USER_ID={USER_ID}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                />
                
                {/* -------------------- 2. CHAT ACTIVO -------------------- */}
                <div className={`
                    ${sidebarOpen ? "hidden" : "flex"}
                    flex-1 flex-col h-full
                    md:flex
                `}>
                    
                    {/* Header */}
                    <ChatHeader 
                        selectedUser={selectedUser}
                        activeUsers={activeUsers}
                        onBack={() => setSidebarOpen(true)}
                    />

                    {/* Área de Mensajes */}
                    {/* Fondo con patrón de WhatsApp y modo oscuro */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://i.imgur.com/uN8XQzL.png')] dark:bg-gray-900/90 dark:bg-blend-multiply bg-repeat">
                        {visibleMessages.map((msg, i) => (
                            <MessageBubble 
                            key={i} 
                            msg={msg} 
                            USER_ID={USER_ID} 
                            formatTime={formatTime} />
                        ))}
                        <div ref={bottomRef}></div>
                    </div>

                    {/* Área de Input */}
                    <ChatInput 
                        text={text}
                        setText={setText}
                        sendText={sendText}
                        showEmojiPicker={showEmojiPicker}
                        setShowEmojiPicker={setShowEmojiPicker}
                        onEmojiClick={(e) => setText(prev => prev + e.emoji)}
                        darkMode={darkMode}
                        fileInputRef={fileInputRef}
                        handleFileChange={handleFileChange}
                        // Audio Props
                        isRecording={isRecording}
                        startRecording={startRecording}
                        stopRecording={stopRecording}
                        cancelRecording={cancelRecording}
                        recordTime={recordTime}
                        audioFile={audioFile}
                        recordedDuration={recordedDuration}
                        sendAudioMessage={sendAudioMessage}
                        // Mic Settings
                        audioDevices={audioDevices}
                        selectedDeviceId={selectedDeviceId}
                        setSelectedDeviceId={setSelectedDeviceId}
                        showMicSettings={showMicSettings}
                        setShowMicSettings={setShowMicSettings}
                    />

                </div>
                
                {/* Overlay de fondo en móvil cuando la sidebar está abierta */}
                {sidebarOpen && (
                    <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)}></div>
                )}
            </div>
            {uiToast ? (
                <div className="fixed top-4 right-4 z-[120] max-w-[320px] rounded-xl border border-red-400/35 bg-red-500/15 text-red-100 px-3 py-2.5 text-[12px] shadow-[0_14px_28px_rgba(0,0,0,0.28)] backdrop-blur">
                    {uiToast}
                </div>
            ) : null}
        </div>
    );
}



