"use client";
import { Download, X } from "lucide-react";

export function MediaViewer({ fileUrl, fileType, fileName, onClose }) {
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
