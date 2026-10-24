"use client"
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Play, Pause, RefreshCw } from 'lucide-react';
import { SERVER_URL } from '@/const';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { Session, TranscriptEntry } from '@/app/interfaces';

interface SessionRecordProps {
  onTranscribed: CallableFunction;
  session: Session;
  flushIntervalSeconds?: number; // Configurable interval (45-60 seconds, defaults to 45)
}

export default function SessionRecord({
  onTranscribed,
  session,
  flushIntervalSeconds = 45
}: SessionRecordProps) {
  const { id } = useParams();
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [callDuration, setCallDuration] = useState(session.total_duration || 0);
  const [audioLevels, setAudioLevels] = useState([
    0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3, 0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3,
    0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3, 0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3
  ]);
  const [loading, setLoading] = useState(false);
  const transcriptContentRef = useRef<TranscriptEntry[]>([]);
  const lastSavedIndexRef = useRef(0);
  const secondsSinceLastFlushRef = useRef(0);
  const router = useRouter();
  const wordCountRef = useRef(session.word_count || 0);
  const timeRef = useRef<number>(0);
  const startTime = useRef<number>(0);
  const audioElement = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection>(null);
  const dcRef = useRef<RTCDataChannel>(null);

  // Configurable interval clamped between 30 and 60 seconds (defaults to 45)
  const intervalSeconds = 20;

  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(() => {
      setCallDuration(d => d + 1);
      secondsSinceLastFlushRef.current += 1;

      // Periodically send next transcript entries every 45-60 seconds if entries exist
      if (secondsSinceLastFlushRef.current >= intervalSeconds) {
        if (transcriptContentRef.current.length > lastSavedIndexRef.current) {
          saveTranscript();
        }
        secondsSinceLastFlushRef.current = 0;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected, intervalSeconds]);

  useEffect(() => {
    if (!isConnected || isMuted) return;
    const interval = setInterval(() => {
      setAudioLevels(prev => prev.map(() => Math.random() * 0.7 + 0.3));
    }, 150);
    return () => clearInterval(interval);
  }, [isConnected, isMuted]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveTranscript = async () => {
    const lastIndex = transcriptContentRef.current.length;
    if (lastIndex <= lastSavedIndexRef.current) return;
    const messages = transcriptContentRef.current.slice(lastSavedIndexRef.current, lastIndex);
    lastSavedIndexRef.current = lastIndex;
    secondsSinceLastFlushRef.current = 0;

    console.log(`Sending next ${messages.length} transcript entries (interval: ${intervalSeconds}s)`);
    try {
      const response = await axios.post(
        `${SERVER_URL}/sessions/${id}/save`,
        { partition: messages },
        { withCredentials: true }
      );
      console.log("Transcript partition saved:", response.data);
      return response.data;
    } catch (error) {
      console.error("Failed to save transcript partition:", error);
    }
  };

  const initSession = async () => {
    setLoading(true);
    try {
      const tokenResponse = await fetch(`${SERVER_URL}/sessions/token`);
      const data = await tokenResponse.json();
      const EPHEMERAL_KEY = data.value;

      const pc = new RTCPeerConnection();

      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => {
        if (audioElement.current) {
          audioElement.current.srcObject = e.streams[0];
        }
      };

      let ms;
      try {
        ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        throw new Error("Microphone access was not accepted or failed: " + (err && err.message ? err.message : err));
      }
      pc.addTrack(ms.getTracks()[0]);

      const dc = pc.createDataChannel("oai-events");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      } as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(answer);

      dc.addEventListener("message", (e) => {
        const event = JSON.parse(e.data) as any;
        switch (event.type) {
          case 'session.created':
            startTime.current = session?.total_duration ? Date.now() - session.total_duration * 1000 : Date.now();
            break;

          case 'input_audio_buffer.speech_started':
            timeRef.current = Date.now();
            break;

          case 'conversation.item.input_audio_transcription.completed':
            const start = timeRef.current - startTime.current;
            if (event.transcript) {
              wordCountRef.current += event.transcript.split(' ').length;
              const obj = {
                start_duration: Math.floor(start / 1000),
                text: event.transcript
              };
              transcriptContentRef.current.push(obj);
              onTranscribed(obj);
            }
            break;

          default:
            break;
        }
      });

      dcRef.current = dc;
      pcRef.current = pc;
      setIsConnected(true);
    } catch (err: any) {
      console.error("Session initialization failed:", err.message);
    } finally {
      setLoading(false);
    }
  };

  async function finishSession() {
    try {
      setIsFinishing(true);
      if (pcRef.current) {
        pcRef.current.close();
      }
      setIsConnected(false);

      // Immediately send any remaining unsaved transcript entries after user stops recording
      if (transcriptContentRef.current.length > lastSavedIndexRef.current) {
        console.log("Sending final remaining transcript entries immediately on stop");
        await saveTranscript();
      }

      const duration = Date.now() - startTime.current;
      await axios.post(
        `${SERVER_URL}/sessions/${id}/finish`,
        {
          total_duration: Math.floor(duration / 1000),
          word_count: wordCountRef.current
        },
        { withCredentials: true }
      );

      router.push(`/session/${id}/view`);
    } catch (err) {
      console.error("Error finishing session:", err);
      setIsFinishing(false);
    }
  }

  return (
    <div className="flex flex-col mb-4 items-center justify-center w-full p-2 rounded-2xl bg-[#101C2F] shadow-lg text-white">
      <audio ref={audioElement}></audio>
      <div className="flex items-center w-full gap-4 px-2 py-2">
        {/* Record/Stop Button and Session Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => !isConnected ? initSession() : finishSession()}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              isConnected
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg shadow-rose-500/40 hover:scale-105 active:scale-95'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40 hover:scale-105 active:scale-95'
            } disabled:opacity-50`}
            disabled={loading || isFinishing}
          >
            {loading || isFinishing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isConnected ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium flex items-center gap-1.5">
              {isFinishing
                ? "Processing AI insights..."
                : isConnected
                ? "Recording..."
                : "Not recording"}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span>{formatTime(callDuration)}</span>
              {isConnected && (
                <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/30">
                  Sync: {intervalSeconds}s
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Audio Waveform Bars */}
        <div className="flex-1 self-center flex items-center justify-center">
          <div className="flex w-full justify-center gap-[2.5px] h-9">
            {audioLevels.map((level, i) => (
              <div
                key={i}
                className="w-[5px] rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400 transition-all duration-150"
                style={{
                  height: isConnected && !isMuted ? `${12 + 50 * level}px` : '18px',
                  opacity: isConnected && !isMuted ? 1 : 0.3,
                  marginLeft: i === 0 ? 0 : '2.5px'
                }}
              />
            ))}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-end gap-3 w-full pr-2">
            {/* Speaker Toggle */}
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`p-2.5 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                !isSpeakerOn
                  ? 'bg-amber-500/20 border-2 border-amber-500/50 text-amber-400'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
              }`}
              title={isSpeakerOn ? "Mute Speaker" : "Unmute Speaker"}
            >
              {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {/* Mic Mute Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                isMuted
                  ? 'bg-rose-500/20 border-2 border-rose-500/50 text-rose-400'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
              }`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
