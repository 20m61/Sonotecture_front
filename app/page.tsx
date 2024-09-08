'use client';
import React, { useState, useEffect } from 'react';

const LocationDisplay: React.FC = () => {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 緯度経度のリアルタイム取得
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          console.log('Latitude:', position.coords.latitude);
          console.log('Longitude:', position.coords.longitude);
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (err) => {
          setError(`Location error: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId); // クリーンアップ
      };
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  }, []);

  // ボタン押下後に向き（方位）取得の許可を求める
  const handlePermissionRequest = async () => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setHeading(event.alpha);
      }
    };

    const requestPermission = async () => {
      const DeviceOrientation = DeviceOrientationEvent as any;
      if (typeof DeviceOrientation.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientation.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          } else {
            setError('Device orientation permission denied.');
          }
        } catch (err) {
          if (err instanceof Error) {
            setError(`Device orientation error: ${err.message}`);
          } else {
            setError('An unknown error occurred during device orientation.');
          }
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    if (window.DeviceOrientationEvent) {
      requestPermission();
    } else {
      setError('Device orientation is not supported by this browser.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#fff',
      }}
    >
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Real-Time Location
      </h1>
      {error ? (
        <p style={{ fontSize: '1.5rem', color: 'red' }}>{error}</p>
      ) : (
        <>
          {latitude && longitude ? (
            <p style={{ fontSize: '1.5rem' }}>
              Lat: {latitude.toFixed(4)}, Lng: {longitude.toFixed(4)}
            </p>
          ) : (
            <p style={{ fontSize: '1.5rem' }}>Fetching location...</p>
          )}
          {heading !== null ? (
            <p style={{ fontSize: '1.5rem', marginTop: '1rem' }}>
              Heading: {Math.round(heading)}°
            </p>
          ) : (
            <p style={{ fontSize: '1.5rem', marginTop: '1rem' }}>
              Fetching heading...
            </p>
          )}
        </>
      )}
      {/* ボタンを追加して、ユーザーに許可を求める */}
      <button
        onClick={handlePermissionRequest}
        style={{ marginTop: '20px', padding: '10px 20px', fontSize: '1.5rem' }}
      >
        Enable Orientation
      </button>
    </div>
  );
};

export default LocationDisplay;
