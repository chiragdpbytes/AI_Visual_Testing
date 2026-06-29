import React, { useState } from "react";
import { 
  auth, 
  googleProvider, 
  db,
  OperationType,
  handleFirestoreError 
} from "../firebase";
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Mail, Lock, User, Sparkles, Key, AlertCircle, ArrowRight, Chrome, Check } from "lucide-react";

interface AuthOverlayProps {
  onSuccess: () => void;
}

export default function AuthOverlay({ onSuccess }: AuthOverlayProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  // Verification states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const clearMessages = () => {
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    clearMessages();
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Post profile reference in users collection
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, "users", user.uid), {
          userId: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          createdAt: new Date().toISOString()
        });
      } catch (dbErr) {
        // Log firestore error beautifully but allow auth to proceed
        console.warn("User record creation failed or permission not configured yet in Firestore:", dbErr);
      }
      
      setSuccessMsg("Logged in successfully with Google!");
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      console.error("Google authenticated request rejected:", err);
      setErrorMsg(err.message || "Unable to authenticate with Google. Ensure Popups are permitted.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMsg("Signed in successfully!");
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      console.error("Credential login failed:", err);
      let message = err.message || "Invalid credentials.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        message = "Incorrect email address or password.";
      } else if (err.code === "auth/operation-not-allowed") {
        message = "Email/Password provider is disabled in Firebase console config.";
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setErrorMsg("All fields are required for sign up.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Update profile display name
      await updateProfile(cred.user, { displayName: name });
      
      // Post user profile reference
      try {
        await setDoc(doc(db, "users", cred.user.uid), {
          userId: cred.user.uid,
          email: email,
          displayName: name,
          photoURL: "",
          createdAt: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn("User document creation failed in Firestore:", dbErr);
      }

      setSuccessMsg("Account registered successfully! Welcome to Veloce QA.");
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      console.error("Registration failed:", err);
      let message = err.message || "Failed to create user account.";
      if (err.code === "auth/email-already-in-use") {
        message = "This email is already linked to an existing account.";
      } else if (err.code === "auth/operation-not-allowed") {
        message = "Email/Password provider is disabled in Firebase console configuration.";
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your account email address first.");
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("Password recovery email sent! Check your inbox.");
    } catch (err: any) {
      console.error("Forgot password flow error:", err);
      setErrorMsg(err.message || "Failed to trigger recovery email link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md overflow-hidden bg-white border border-slate-200 shadow-2xl rounded-3xl flex flex-col">
        
        {/* Auth dialog header */}
        <div className="bg-white border-b border-slate-100 p-6 text-center shadow-xs">
          <div className="inline-flex p-2.5 rounded-2xl bg-indigo-50/50 text-indigo-600 mb-2.5 shadow-2xs border border-indigo-100/30 animate-pulse">
            <Sparkles size={22} className="text-indigo-600" />
          </div>
          <h3 className="text-xl font-sans font-bold text-slate-900 tracking-tight leading-tight">Veloce QA Authenticator</h3>
          <p className="text-slate-450 text-[11px] font-normal mt-1 leading-snug max-w-[280px] mx-auto">
            Automated Figma to Code Comparative Layout Audit Sandbox
          </p>
        </div>

        {/* Dynamic status feedback banner */}
        {errorMsg && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-slide-up">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
            <div className="leading-snug">{errorMsg}</div>
          </div>
        )}
        
        {successMsg && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-slide-up">
            <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
            <div className="leading-snug font-medium">{successMsg}</div>
          </div>
        )}

        <div className="p-6 flex-1 space-y-6">
          
          {/* Main Action - Google OAuth Sign-In */}
          <div className="space-y-2.5">
            <button
              onClick={handleGoogleLogin}
              type="button"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-900 border border-slate-800 hover:bg-slate-950 text-white font-bold rounded-xl text-xs sm:text-xs flex items-center justify-center gap-2.5 transition-all shadow-sm active:translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Chrome size={15} className="text-rose-400" />
              Sign in securely with Google
            </button>
            <div className="flex items-center justify-center gap-3">
              <span className="h-[1px] bg-slate-200 flex-1"></span>
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Or credentials</span>
              <span className="h-[1px] bg-slate-200 flex-1"></span>
            </div>
          </div>

          {/* Conditional forms based on auth sub-actions */}
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    className="w-full bg-slate-50 border border-slate-200 font-medium rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 placeholder-slate-400"
                    placeholder="Enter registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Mail size={13} className="text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    clearMessages();
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 border-none bg-transparent cursor-pointer"
                >
                  ◄ Return to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  Reset Password <ArrowRight size={11} />
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Form Tab selection */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("signin");
                    clearMessages();
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors border-none cursor-pointer ${
                    activeTab === "signin" 
                      ? "bg-white text-slate-900 shadow-2xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("signup");
                    clearMessages();
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors border-none cursor-pointer ${
                    activeTab === "signup" 
                      ? "bg-white text-slate-900 shadow-2xs" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={activeTab === "signin" ? handleEmailSignIn : handleEmailSignUp} className="space-y-4">
                
                {activeTab === "signup" && (
                  <div className="space-y-1 animate-slide-down">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">Full Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-50 border border-slate-200 font-medium rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 placeholder-slate-400"
                        placeholder="e.g. Chirag Patel"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <User size={13} className="text-slate-400 absolute left-3 top-3.5" />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      className="w-full bg-slate-50 border border-slate-200 font-medium rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 placeholder-slate-400"
                      placeholder="chirag.patel@bytestechnolab.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Mail size={13} className="text-slate-400 absolute left-3 top-3.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">Password</label>
                    {activeTab === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          clearMessages();
                        }}
                        className="text-[10px] text-indigo-650 hover:text-indigo-800 font-semibold border-none bg-transparent cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      className="w-full bg-slate-50 border border-slate-200 font-medium rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 placeholder-slate-400"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Lock size={13} className="text-slate-400 absolute left-3 top-3.5" />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {activeTab === "signin" ? "Login Securely" : "Register Credentials"}
                    <ArrowRight size={13} />
                  </button>
                </div>
              </form>
            </>
          )}



        </div>

      </div>
    </div>
  );
}
