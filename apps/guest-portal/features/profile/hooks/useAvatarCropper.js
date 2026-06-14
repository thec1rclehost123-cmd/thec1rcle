"use client";

import { useCallback, useRef, useState } from "react";
import { uploadGuestAvatar } from "../api/profileApi";

async function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function getCroppedImageBlob(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
  });
}

export function useAvatarCropper({ profile, user, onUploadComplete }) {
  const fileInputRef = useRef(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [imageSrc, setImageSrc] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const onCropComplete = useCallback((_croppedArea, nextPixels) => {
    setCroppedAreaPixels(nextPixels);
  }, []);

  const resetCropper = useCallback(() => {
    setCropperOpen(false);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return { error: null };
    if (!file.type.startsWith("image/")) {
      return { error: "Please upload an image file (JPG, PNG, GIF, etc.)" };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { error: "Image must be smaller than 10MB" };
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    return { error: null };
  }, []);

  const handleCropSave = useCallback(async () => {
    if (!croppedAreaPixels || !imageSrc) return { error: null, url: null };

    setUploadingImage(true);
    setCropperOpen(false);
    try {
      const croppedBlob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      const nextFile = new File(
        [croppedBlob],
        `${profile?.uid || Date.now()}-${Date.now()}.jpg`,
        { type: "image/jpeg" },
      );
      const downloadURL = await uploadGuestAvatar(nextFile);
      onUploadComplete?.(downloadURL);
      setImageSrc(null);
      return { error: null, url: downloadURL };
    } catch (error) {
      if (user?.photoURL) {
        onUploadComplete?.(user.photoURL);
      }
      return { error: error.message || "Failed to upload image. Please try again.", url: null };
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [croppedAreaPixels, imageSrc, onUploadComplete, profile?.uid, user?.photoURL]);

  return {
    crop,
    cropperOpen,
    fileInputRef,
    handleCropSave,
    handleFileChange,
    imageSrc,
    onCropComplete,
    openFilePicker,
    resetCropper,
    setCrop,
    setZoom,
    uploadingImage,
    zoom,
  };
}
