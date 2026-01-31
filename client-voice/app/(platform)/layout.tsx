import React from "react";
import Sidebar from "@/components/nav/Sidebar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Temporary placeholder user object, replace with real data as needed
  
  // INSERT_YOUR_CODE
  // To get cookies server-side in a Next.js app, use the cookies() function from 'next/headers'
  

  const cookieStore = await cookies();
  // Example: Get a specific cookie value (e.g., 'token')
  const token = cookieStore.get("auth_token");
  if(!token){
    return redirect('/login')
  }
  
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar
        
        // onNavigate={handleNavigate}
        // onLogout={handleLogout}
      />
      <main className="flex-1 h-screen overflow-y-scroll">{children}</main>
    </div>
  );
}
