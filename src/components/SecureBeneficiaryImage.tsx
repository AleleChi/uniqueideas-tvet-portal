import React, { useState, useEffect } from "react";
import { authFetch } from "../utils/authFetch";

interface SecureBeneficiaryImageProps {
  id: string;
  className?: string;
  alt?: string;
  fallbackInitials?: string;
  style?: React.CSSProperties;
}

// In-memory cache mapping beneficiaryId -> objectUrl
const photoCache = new Map<string, string>();

export function SecureBeneficiaryImage({
  id,
  className = "w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs",
  alt = "Beneficiary Passport",
  fallbackInitials = "",
  style
}: SecureBeneficiaryImageProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(photoCache.get(id) || null);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(!!photoCache.get(id));

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    // Use cached URL if available to avoid refetching
    if (photoCache.has(id)) {
      setImgSrc(photoCache.get(id)!);
      setLoaded(true);
      setHasError(false);
      return;
    }

    async function fetchSecurePhoto() {
      try {
        console.log("PHOTO FETCH", id);
        const response = await authFetch(`/api/beneficiaries/${id}/photo/raw`);
        if (!response.ok) {
          throw new Error(`Failed to load raw beneficiary photo: ${response.status}`);
        }
        
        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error("Received empty photo data blob.");
        }

        if (!active) return;

        const objectUrl = URL.createObjectURL(blob);
        localUrl = objectUrl;

        // Cache the objectUrl
        photoCache.set(id, objectUrl);

        if (active) {
          setImgSrc(objectUrl);
          setHasError(false);
        }
      } catch (err) {
        console.error(`Error loading secure photo for beneficiary ${id}:`, err);
        if (active) {
          setHasError(true);
        }
      }
    }

    setLoaded(false);
    setHasError(false);
    fetchSecurePhoto();

    return () => {
      active = false;
      // Revoke the object URL if it was created during this mount session
      // but was not cached, to prevent memory leaks.
      if (localUrl && !photoCache.has(id)) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [id]);

  if (hasError) {
    return (
      <div 
        className={`${className} bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-mono text-xs font-bold`}
        style={style}
        id={`secure-img-error-${id}`}
      >
        {fallbackInitials}
      </div>
    );
  }

  return (
    <div className="relative inline-block" style={style} id={`secure-img-container-${id}`}>
      {imgSrc && (
        <img
          src={imgSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          className={`${className} ${loaded ? "block" : "hidden"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setHasError(true)}
          id={`secure-img-el-${id}`}
        />
      )}
      {!loaded && (
        <div 
          className={`${className} bg-slate-50 border border-slate-200 animate-pulse flex items-center justify-center text-slate-400 font-mono text-xs font-bold`}
          id={`secure-img-loading-${id}`}
        >
          {fallbackInitials}
        </div>
      )}
    </div>
  );
}
