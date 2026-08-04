'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../components/providers/AuthProvider';
import { useAvatarCropper } from './useAvatarCropper';

function buildInitialForm(profile) {
  const rawPhone = profile?.phoneNumber || profile?.phone || '';
  const cleanPhone = rawPhone.replace(/\D/g, '').replace(/^91/, '').slice(0, 10);
  return {
    city: profile?.city || '',
    displayName: profile?.displayName || '',
    gender: profile?.gender || '',
    instagram: profile?.instagram || '',
    phoneNumber: cleanPhone,
    photoURL: profile?.photoURL || profile?.avatar || '',
  };
}

const PHONE_DIGITS_REGEX = /^\d{10}$/;

function normalizeProfileUpdate(formData, user) {
  const nextProfile = { ...formData };
  if (nextProfile.photoURL?.includes('firebasestorage.googleapis.com')) {
    const isSocialUser =
      user?.photoURL &&
      (user.photoURL.includes('googleusercontent.com') ||
        user.photoURL.includes('facebook') ||
        user.photoURL.includes('dicebear'));
    if (isSocialUser) {
      nextProfile.photoURL = user.photoURL;
      nextProfile.avatar = user.photoURL;
    }
  }
  return nextProfile;
}

export function useEditProfileFlow({ onClose }) {
  const { changePassword, profile, updateUserProfile, user } = useAuth();
  const isGoogleUser = user?.providerData?.some((provider) => provider.providerId === 'google.com');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagePreview, setImagePreview] = useState(profile?.photoURL || profile?.avatar || '');
  const [formData, setFormData] = useState(() => buildInitialForm(profile));
  const [passwordData, setPasswordData] = useState({
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
  });
  const [mounted, setMounted] = useState(false);

  const avatarCropper = useAvatarCropper({
    onUploadComplete: (downloadURL) => {
      setFormData((previous) => ({ ...previous, avatar: downloadURL, photoURL: downloadURL }));
      setImagePreview(downloadURL);
    },
    profile,
    user,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    crop: avatarCropper.crop,
    cropperOpen: avatarCropper.cropperOpen,
    error,
    fileInputRef: avatarCropper.fileInputRef,
    formData,
    handleChange: (event) => {
      const { name, value } = event.target;
      const nextValue = name === 'phoneNumber' ? value.replace(/\D/g, '').slice(0, 10) : value;
      setFormData((previous) => ({ ...previous, [name]: nextValue }));
    },
    handleCropCancel: avatarCropper.resetCropper,
    handleCropSave: async () => {
      setError('');
      setUploadingImage(true);
      const result = await avatarCropper.handleCropSave();
      if (result?.error) {
        setError(result.error);
      }
      setUploadingImage(false);
    },
    handleFileChange: async (event) => {
      setError('');
      const result = await avatarCropper.handleFileChange(event);
      if (result?.error) {
        setError(result.error);
      }
    },
    handleFileClick: avatarCropper.openFilePicker,
    handlePasswordChange: (event) => {
      setPasswordData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    },
    handleSubmit: async (event) => {
      event.preventDefault();
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        if (formData.phoneNumber && !PHONE_DIGITS_REGEX.test(formData.phoneNumber)) {
          throw new Error('Phone number must contain exactly 10 digits.');
        }

        const normalizedProfile = normalizeProfileUpdate(formData, user);
        await updateUserProfile(normalizedProfile);

        if (passwordData.newPassword) {
          if (passwordData.newPassword !== passwordData.confirmPassword) {
            throw new Error('New passwords do not match');
          }
          if (!passwordData.currentPassword) {
            throw new Error('Current password is required to change password');
          }
          await changePassword(passwordData.currentPassword, passwordData.newPassword);
        }

        setSuccess('Profile updated successfully!');
        setTimeout(() => {
          onClose();
        }, 1000);
      } catch (submitError) {
        setError(submitError.message || 'Failed to update profile. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    imagePreview,
    imageSrc: avatarCropper.imageSrc,
    isGoogleUser,
    loading,
    mounted,
    onCropComplete: avatarCropper.onCropComplete,
    passwordData,
    profile,
    setCrop: avatarCropper.setCrop,
    setFormData,
    setZoom: avatarCropper.setZoom,
    success,
    uploadingImage,
    zoom: avatarCropper.zoom,
  };
}
