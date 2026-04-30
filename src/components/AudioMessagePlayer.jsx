"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { formatTime } from '@/utils/utils.js'


export const AudioMessagePlayer = ({ audioURL, duration, isMe }) => {
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
            <button type="button" onClick={togglePlay} className="text-gray-500 dark:text-gray-300" aria-label={isPlaying ? "Pausar audio" : "Reproducir audio"}>
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
