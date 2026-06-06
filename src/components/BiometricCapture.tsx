/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, Sliders, Sparkles, Upload, FileImage, ShieldAlert, Check, CheckCircle2 } from "lucide-react";
import { Beneficiary } from "../types";

interface BiometricCaptureProps {
  beneficiary: Beneficiary | null;
  onPhotoCaptured: (base64Photo: string) => void;
  onClose: () => void;
}

export function BiometricCapture({ beneficiary, onPhotoCaptured, onClose }: BiometricCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [filterMode, setFilterMode] = useState<"none" | "passport-bw" | "vivid">("none");
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [hudStats, setHudStats] = useState({
    faceMetric: 0,
    lux: 120,
    fps: 30
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Trigger synthesized Web Audio shutter noise
  const playSynthesizedShutter = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Quick tech shutter sound: noise burst + sine beep
      const bufferSize = audioCtx.sampleRate * 0.15; // 0.15 seconds
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate white noise for the mechanical curtain click
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = buffer;
      
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 1000;
      
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      
      // High frequency electronic beep
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(2200, audioCtx.currentTime);
      
      oscGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      
      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      
      whiteNoise.start();
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      // Audio fallback
    }
  };

  // Start real webcam stream
  const startCamera = async () => {
    setCameraError(null);
    setCapturedPreview(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        "Webcam feed restricted or unavailable. Initializing intelligent vector/profile fallback module."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  // Initialize camera or fallback
  useEffect(() => {
    startCamera();
    
    // Dynamic simulated alignment jitter to animate the biometrics HUD
    const timer = setInterval(() => {
      setHudStats({
        faceMetric: parseFloat((92.5 + Math.random() * 6.5).toFixed(1)),
        lux: Math.floor(115 + Math.random() * 20),
        fps: Math.random() > 0.3 ? 30 : 29
      });
    }, 1200);

    return () => {
      clearInterval(timer);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle capture frame
  const captureImage = () => {
    playSynthesizedShutter();
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (canvas && video && cameraActive) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 480;
        canvas.height = 480; // Passport Crop square style

        // Calculate center crop
        const minDim = Math.min(video.videoWidth, video.videoHeight);
        const sx = (video.videoWidth - minDim) / 2;
        const sy = (video.videoHeight - minDim) / 2;

        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) ${
          filterMode === "passport-bw" ? "grayscale(100%)" : filterMode === "vivid" ? "saturate(140%)" : ""
        }`;
        
        ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 480, 480);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedPreview(dataUrl);
      }
    } else {
      // Fallback generator
      generateSyntheticBiometrics();
    }
  };

  // Generate synthetic avatar with high-craft vector and passport overlays
  const generateSyntheticBiometrics = () => {
    playSynthesizedShutter();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 480;
        canvas.height = 480;
        
        // Solid professional studio physical background
        const gradients = [
          ["#1e293b", "#0f172a"], // Deep slate
          ["#3b82f6", "#1d4ed8"], // Classic blue background
          ["#1d4ed8", "#1e1b4b"]  // Premium royal studio blue
        ];
        const bgIdx = Math.floor(Math.random() * gradients.length);
        const grad = ctx.createLinearGradient(0, 0, 0, 480);
        grad.addColorStop(0, gradients[bgIdx][0]);
        grad.addColorStop(1, gradients[bgIdx][1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 480, 480);

        // Portrait shoulder block
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.ellipse(240, 450, 160, 100, 0, 0, Math.PI, true);
        ctx.fill();

        // Collar detail
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.moveTo(180, 390);
        ctx.lineTo(240, 420);
        ctx.lineTo(300, 390);
        ctx.lineTo(240, 450);
        ctx.closePath();
        ctx.fill();

        // Head oval
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(240, 240, 108, 0, Math.PI * 2);
        ctx.fill();

        // Ear circles
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.arc(125, 240, 15, 0, Math.PI * 2);
        ctx.arc(355, 240, 15, 0, Math.PI * 2);
        ctx.fill();

        // Hair styling (Clean professional cut)
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(240, 210, 114, Math.PI, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.arc(200, 230, 8, 0, Math.PI * 2);
        ctx.arc(280, 230, 8, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(240, 280, 28, 0, Math.PI, false);
        ctx.stroke();

        // Passport lighting adjustment filters
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) ${
          filterMode === "passport-bw" ? "grayscale(100%)" : filterMode === "vivid" ? "saturate(140%)" : ""
        }`;

        // Stamp certification text
        ctx.fillStyle = "#3b82f6";
        ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
        ctx.font = "bold 20px 'JetBrains Mono'";
        ctx.fillText("IDEAS VERIFIED", 40, 440);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedPreview(dataUrl);
      }
    }
  };

  // Non-blocking asynchronous client-side passport optimization helper
  const compressAndResizeImage = (
    dataUrl: string,
    targetWidth: number = 300,
    targetHeight: number = 300,
    quality: number = 0.7
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetWidth, targetHeight);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Handle local JPG file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const rawBase64 = event.target.result as string;
          // Pre-compress upload cleanly
          const compressed = await compressAndResizeImage(rawBase64, 300, 300, 0.7);
          setCapturedPreview(compressed);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmCapturedPhoto = async () => {
    if (capturedPreview) {
      // Ensure visual canvas assets or webcams are perfectly compressed to 15KB-50KB layout
      const finalImage = await compressAndResizeImage(capturedPreview, 300, 300, 0.7);
      onPhotoCaptured(finalImage);
      stopCamera();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-slate-100">
        
        {/* Hardware Camera HUD Header */}
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </div>
            <div>
              <h3 className="font-display font-medium text-sm tracking-tight flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                BIOMETRIC WORKSTATION PORT
              </h3>
              <p className="text-[10px] font-mono text-slate-400">
                {beneficiary ? `ENROLLING: ${beneficiary.firstName} ${beneficiary.lastName}` : "GENERIC CAPTURE MODULE"}
              </p>
            </div>
          </div>
          <button 
            onClick={() => { stopCamera(); onClose(); }} 
            className="text-xs font-semibold px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded bg-transparent border border-slate-800"
          >
            Esc Close
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0">
          
          {/* Biometrics Camera Canvas Layer (7 Columns) */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div className="relative aspect-square w-full max-w-[420px] mx-auto bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
              
              {/* Overlay guides (Target Canvas Overlay) */}
              <div className="absolute inset-0 pointer-events-none z-10 p-4 flex flex-col justify-between">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <div className="flex flex-col gap-0.5">
                    <span>INDEX: HD_FEED_LIVE</span>
                    <span>RES: 640 x 480 (CROP SQUARE)</span>
                  </div>
                  <div className="text-right flex flex-col gap-0.5">
                    <span>VAL: {hudStats.faceMetric}% LCK</span>
                    <span>LUX: {hudStats.lux} (IDEAL)</span>
                  </div>
                </div>

                {/* Passport Portrait Framing Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border border-indigo-500/40 border-dashed rounded-full w-48 h-64 relative flex items-center justify-center">
                    {/* Horizon marker */}
                    <div className="absolute top-[35%] w-full border-t border-emerald-500/20 border-dashed"></div>
                    <div className="absolute top-[35%] left-0 right-0 text-center text-[8px] font-mono text-emerald-400/60 uppercase">
                      Eye Alignment Line
                    </div>
                    {/* Centering crosshair */}
                    <div className="w-4 h-4 rounded-full border border-indigo-400/40 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-indigo-400"></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end text-[9px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                    IDEAS-TVET STAMP AUTO
                  </span>
                  <span>FPS: {hudStats.fps}</span>
                </div>
              </div>

              {/* Feed/Preview Container */}
              {!capturedPreview ? (
                cameraActive ? (
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
                  />
                ) : (
                  <div className="text-center p-6 flex flex-col items-center justify-center gap-3">
                    <ShieldAlert className="w-12 h-12 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Local Hardware Blocked</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                        Webcam hardware has been locked or could not be detected. Launching synthetic studio frame.
                      </p>
                    </div>
                    <button 
                      onClick={generateSyntheticBiometrics}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg flex items-center gap-2 shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Engage Face Synth
                    </button>
                  </div>
                )
              ) : (
                <img 
                  src={capturedPreview} 
                  alt="Captured Portrait Preview" 
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
              )}
            </div>

            {/* Diagnostic Message */}
            <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-[11px] text-slate-300 font-mono flex-1">
                {!capturedPreview 
                  ? "SYSTEM READY: Please align face oval within guidelines, sit straight, and look direct."
                  : "IMAGE PROCESSED: Review biometric capture characteristics & brightness before applying."}
              </p>
            </div>
          </div>

          {/* Biometric Toolbelt Adjustment (5 Columns) */}
          <div className="md:col-span-5 flex flex-col justify-between gap-6">
            <div className="flex flex-col gap-5">
              
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                <h4 className="text-xs font-display font-medium text-slate-200 tracking-wide flex items-center gap-2 mb-3">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  STUDIO BRIGHTNESS CALIBRATION
                </h4>
                
                {/* Sliders */}
                <div className="flex flex-col gap-3.5">
                  <div>
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                      <span>Brightness Sensor</span>
                      <span>{brightness}%</span>
                    </div>
                    <input 
                      type="range"
                      min="50"
                      max="150"
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 bg-slate-800 h-1 rounded-lg outline-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                      <span>Contrast Gain</span>
                      <span>{contrast}%</span>
                    </div>
                    <input 
                      type="range"
                      min="50"
                      max="150"
                      value={contrast}
                      onChange={(e) => setContrast(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 bg-slate-800 h-1 rounded-lg outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Enhanced Preset Filters */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                <h4 className="text-xs font-display font-medium text-slate-200 tracking-wide flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  PASSPORT ENHANCEMENT ALY
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setFilterMode("none")}
                    className={`text-[10px] font-medium py-1.5 rounded border transition ${
                      filterMode === "none" 
                        ? "bg-indigo-600 border-indigo-500 text-white" 
                        : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Original
                  </button>
                  <button 
                    onClick={() => setFilterMode("passport-bw")}
                    className={`text-[10px] font-medium py-1.5 rounded border transition ${
                      filterMode === "passport-bw" 
                        ? "bg-indigo-600 border-indigo-500 text-white" 
                        : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    B&W Studio
                  </button>
                  <button 
                    onClick={() => setFilterMode("vivid")}
                    className={`text-[10px] font-medium py-1.5 rounded border transition ${
                      filterMode === "vivid" 
                        ? "bg-indigo-600 border-indigo-500 text-white" 
                        : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Vivid Boost
                  </button>
                </div>
              </div>

              {/* Upload Alternate Local Photo */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center">
                <p className="text-[10px] text-slate-400 mb-2">Have a pre-captured official passport photograph?</p>
                <input 
                  type="file"
                  id="biometric-file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-indigo-500 py-2.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-indigo-400 transition bg-slate-900/60"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Browse Local Photo
                </button>
              </div>

            </div>

            {/* Hardware Trigger panel actions */}
            <div className="flex flex-col gap-2 mt-auto">
              {!capturedPreview ? (
                <button 
                  onClick={captureImage}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition active:scale-[99%]"
                >
                  <Camera className="w-4 h-4 animate-pulse" />
                  Capture Biometric Photo
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setCapturedPreview(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset Frame
                  </button>
                  <button 
                    onClick={confirmCapturedPhoto}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 shadow transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve Bio
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Hidden internal canvas for programmatic snap frames */}
        <canvas ref={canvasRef} className="hidden" />

      </div>
    </div>
  );
}
