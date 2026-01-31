"use client"
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Settings, MoreVertical, Sparkles, Waves, Loader2 } from 'lucide-react';
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
    }catch(err:typeof Error){
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

  // INSERT_YOUR_CODE
  // Helper function to fetch a session by id from the API using axios
  // async function fetchSession() {
  //   try {
  //     setIsLoading(true)
  //     const response = await axios.get(`${SERVER_URL}/sessions/${id}`);
  //     console.log(response.data)
  //     let session = response.data.session
  //     setSession(session)
      
  //     setCallDuration(session.total_duration)
  //     wordCountRef.current = session.word_count
  //   } catch (error) {
  //     console.error('Failed to fetch session:', error);
  //     return null;
  //   }finally{
  //     setIsLoading(false)
  //   }
  // }

  // useEffect(()=>{
  //   fetchSession()
  // },[])

  // INSERT_YOUR_CODE
  // if (isLoading) {
  //   return (
  //     <LoadingScreen loadingText='Loading session details ...'></LoadingScreen>
  //   )
  // }



  return (
    <div className=" text-white flex flex-col">
      {/* Ambient background */}
      {/* <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div> */}
      <audio ref={audioElement}></audio>

      

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col px-6">
        {/* Avatar with audio visualization */}
        <div className="relative mb-8">
          {/* Outer rings */}
          {isConnected && !isMuted && (
            <>
              <div className="absolute inset-0 -m-4 rounded-full border-2 border-violet-500/30 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 -m-8 rounded-full border border-violet-500/20 animate-ping" style={{ animationDuration: '2.5s' }} />
              <div className="absolute inset-0 -m-12 rounded-full border border-violet-500/10 animate-ping" style={{ animationDuration: '3s' }} />
            </>
          )}
          
          {/* Glow effect */}
          <div className={`absolute inset-0 -m-6 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-2xl transition-opacity duration-500 ${
            isConnected && !isMuted ? 'opacity-40' : 'opacity-10'
          }`} />
          
          {/* Avatar */}
          { /** <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 p-1 shadow-2xl shadow-violet-500/30">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <Waves className="w-12 h-12 text-violet-400" />
            </div>
          </div>
          **/}
          {/* Status badge */}
          {/* <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium transition-all ${
            isMuted 
              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400' 
              : 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
          }`}>
            {isMuted ? 'Muted' : 'Speaking'}
          </div> */}
        </div>

        {/* Title */}
        <div className='flex w-full gap-8 justify-center'>

            {/* <h1 className="text-md font-bold mb-2 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {session?.title || "New Voice Session"}
            </h1> */}
            {/* <p className="text-slate-500 mb-8">{id}</p> */}

            {/* Timer */}
            <div className="flex items-center gap-3 px-2 py-1 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-md font-mono font-light tracking-wider text-white/90">
                {formatTime(callDuration)}
            </span>
            </div>
        </div>
        

        <div className="flex items-center justify-center gap-1.5 h-16 ">
        {audioLevels.map((level, i) => (
            <div
            key={i}
            className="w-1.5 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400 transition-all duration-150"
            style={{
                height: isConnected && !isMuted ? `${level * 100}%` : '20%',
                opacity: isConnected && !isMuted ? 1 : 0.3
            }}
            />
        ))}
        </div>
        {/* Controls */}
        <div className="relative z-10 p-6 pb-10">
            {/* Connection quality */}
            {/* <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="flex items-center gap-0.5">
                {[...Array(4)].map((_, i) => (
                    <div
                    key={i}
                    className="w-1 rounded-full bg-emerald-500"
                    style={{ height: `${6 + i * 3}px` }}
                    />
                ))}
                </div>
                <span>Excellent</span>
            </div>
            </div> */}

            {/* Control buttons */}
            <div className="flex items-center justify-center gap-6">
            {/* Speaker */}
            <button
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`p-3 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                !isSpeakerOn
                    ? 'bg-amber-500/20 border-2 border-amber-500/50 text-amber-400'
                    : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
                }`}
            >
                {isSpeakerOn ? <Volume2 className=" w-5 h-5" /> : <VolumeX className=" w-5 h-5" />}
            </button>

            {/* End/Start Call */}
            <button
                onClick={() => !isConnected ? initSession() : finishSession()}
                className={`p-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${
                isConnected
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-lg shadow-rose-500/40'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/40'
                }`}
                disabled={loading}
            >
                {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
                ) : isConnected ? (
                <PhoneOff className="w-5 h-5" />
                ) : (
                <Phone className="w-5 h-5" />
                )}
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
                {isMuted ? <MicOff className=" w-5 h-5" /> : <Mic className=" w-5 h-5" />}
            </button>
            </div>
        </div>
        

        </div>
        {/* Audio visualizer */}
    </div>
  );
}