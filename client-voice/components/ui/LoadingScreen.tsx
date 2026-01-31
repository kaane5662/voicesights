import { Loader2 } from "lucide-react";
import { ReactElement } from "react";

export default function LoadingScreen({loadingIcon, loadingText}:{loadingText:string,loadingIcon?:ReactElement}){
    return(
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="flex flex-col items-center">
          <span className="animate-spin mb-4 text-purple-800">
           
            <Loader2 className="w-20 h-10" />
          </span>
          <span className="text-lg text-slate-300">{loadingText}</span>
        </div>
      </div>
    );
    
}