"use client"
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Settings, MoreVertical, Sparkles, Waves, Loader2, Play, Pause } from 'lucide-react';
import { SERVER_URL } from '@/const';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { ChatMessage, Session, TranscriptEntry } from '@/app/interfaces';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function SessionRecord({onTranscribed,session}:{onTranscribed:CallableFunction, session:Session}) {
  const {id} = useParams()
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading,setIsLoading] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(session.total_duration);
  const [audioLevels, setAudioLevels] = useState([0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3, 0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3,0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3, 0.3, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5, 0.3]);
  const [loading,setLoading] = useState(false)
  const transcriptContentRef = useRef<TranscriptEntry[]>([])
  const lastSavedIndexRef  = useRef(0)
  const router = useRouter()
  const wordCountRef = useRef(session.word_count)
  const timeRef = useRef<number>(0)
  const startTime = useRef<number>(0)
  // const currentTime = useRef(0)
  const saveIncrement = 5
  const audioElement = useRef<HTMLAudioElement>(null)
  const pcRef = useRef<RTCPeerConnection>(null)
  const dcRef = useRef<RTCDataChannel>(null)
  
  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(() => {
      if(transcriptContentRef.current.length %saveIncrement == 0 &&  
        transcriptContentRef.current.length /saveIncrement != 0 && 
        transcriptContentRef.current.length > lastSavedIndexRef.current){
        saveTranscript()
      }
        
      setCallDuration(d => d + 1)
      
    }, 1000
  
    );
    return () => clearInterval(timer);
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected || isMuted) return;
    const interval = setInterval(() => {
      setAudioLevels(prev => prev.map(() => Math.random() * 0.7 + 0.3));
    }, 150);
    return () => clearInterval(interval);
  }, [isConnected, isMuted]);


  const formatTime = (s:number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveTranscript = async()=>{
    
   
    let lastIndex = transcriptContentRef.current.length
    let messages = transcriptContentRef.current.slice(lastSavedIndexRef.current,lastIndex)
    console.log('Saving transcript data')
    console.log('messages',transcriptContentRef.current)
    console.log('partiton',messages)
    lastSavedIndexRef.current = lastIndex
    axios.post(`${SERVER_URL}/sessions/${id}/save`, {
      partition: messages
    },{withCredentials:true})
    .then(response => {
      console.log("Transcript saved:", response.data);
    })
    .catch(error => {
      console.error("Failed to save transcript:", error);
    });

  }


  
  const initSession = async()=>{
    // Get a session token for OpenAI Realtime API
    setLoading(true)
    try{

      const tokenResponse = await fetch(`${SERVER_URL}/sessions/token`);
      const data = await tokenResponse.json();
      console.log(data)
      const EPHEMERAL_KEY = data.value;
  
      // Create a peer connection
      const pc = new RTCPeerConnection();
      
      
      // Set up to play remote audio from the model
      // if(!audioElement.current?.srcObject) return
      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);
  
      // Add local audio track for microphone input in the browser
      let ms;
      try {
        ms = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
      } catch (err:any) {
        throw new Error("Microphone access was not accepted or failed: " + (err && err.message ? err.message : err));
      }
      // const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
      // const systemStream = await navigator.mediaDevices.getDisplayMedia({
      //   video: false,
      //   audio: true
      // });
      pc.addTrack(ms.getTracks()[0]);
  
      // Set up data channel for sending and receiving events
      const dc = pc.createDataChannel("oai-events");
  
      // Start the session using the Session Description Protocol (SDP)
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
          // console.log(event)
          switch (event.type) {
            case 'session.created':
              startTime.current = session?.total_duration ? Date.now()-session.total_duration*1000 : Date.now() 
  
            case 'input_audio_buffer.speech_started':
              timeRef.current = Date.now()
            case 'conversation.item.input_audio_transcription.delta':
              console.log("Delta string",event.delta)
            case "conversation.item.input_audio_transcription.completed":
              // Handle completed input audio transcription event
              // Example: event.item.transcription (see docs for full shape)
              
              let start = timeRef.current - startTime.current 
              
            //   console.log("Transcription completed:", start/1000,event.transcript);
              if(event.transcript){
                wordCountRef.current += event.transcript.split(' ').length
                let obj = {start_duration:Math.floor(start/1000),text:event.transcript}
                transcriptContentRef.current.push(obj)
                onTranscribed(obj)
              }
              // console.log(transcriptRef.current)
              break;
            
            default:
              break;
          }
          
      });
      dcRef.current = dc
      pcRef.current = pc
      setIsConnected(true)
    }catch(err:any){
      console.log(err.message)
    }finally{
      setLoading(false)
    }
  }

  

  async function finishSession() {
    try {
      if(pcRef.current){
          pcRef.current.close()
      }
      setIsConnected(false)
      // didnt save remaining transcripts
      if(transcriptContentRef.current.length > lastSavedIndexRef.current ) await saveTranscript()
      console.log("closed sesison")
      let duaration = Date.now() - startTime.current  
      const response = await axios.post(`${SERVER_URL}/sessions/${id}/finish`,{total_duration: Math.floor(duaration/1000), word_count: wordCountRef.current},{withCredentials:true});
      router.push(`/session/${id}/view`)
    } catch (err) {
      console.error("Error finishing session:", err);
      throw err;
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
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg shadow-rose-500/40'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40'
            }`}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isConnected ? (
              <Pause className="w-6 h-6 fill-white" />
            ) : (
              <Play className="w-6 h-6 fill-white" />
            )}
          </button>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">
              {isConnected ? "Recording..." : "Not recording"}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {formatTime(callDuration)}
            </span>
          </div>
        </div>

        {/* Audio Bars */}
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

        {/* Right Options */}
        <div className="flex items-center gap-4">
          
          {/* Controls Row */}
          <div className="flex items-center justify-end gap-3 w-full mt-2 pr-2 pb-1">
            {/* Speaker */}
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                !isSpeakerOn
                  ? 'bg-amber-500/20 border-2 border-amber-500/50 text-amber-400'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            {/* Mute */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                isMuted
                  ? 'bg-rose-500/20 border-2 border-rose-500/50 text-rose-400'
                  : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}