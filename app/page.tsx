'use client';
import React, { useState, useEffect } from 'react';

const LocationDisplay: React.FC = () => {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 位置情報取得のしきい値（前回の値と比較し変化が大きい場合のみ更新）
  const positionThreshold = 0.0001;
  const headingThreshold = 1;

  // 緯度経度のリアルタイム取得
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLatitude = position.coords.latitude;
          const newLongitude = position.coords.longitude;

          // 一定の変化があったときのみ更新
          if (
            !latitude ||
            Math.abs(newLatitude - latitude) > positionThreshold
          ) {
            setLatitude(newLatitude);
          }
          if (
            !longitude ||
            Math.abs(newLongitude - longitude) > positionThreshold
          ) {
            setLongitude(newLongitude);
          }
        },
        (err) => {
          setError(`Location error: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId); // クリーンアップ
      };
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  }, [latitude, longitude]);

  // 向き（方位）のリアルタイム取得
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        const newHeading = event.alpha;
        // 1度以上変化があった場合のみ更新
        if (!heading || Math.abs(newHeading - heading) > headingThreshold) {
          setHeading(newHeading);
        }
      }
    };

    const requestPermission = async () => {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          } else {
            setError('Device orientation permission denied.');
          }
        } catch (err) {
          setError(`Device orientation error: ${err.message}`);
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

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [heading]);

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
    </div>
  );
};

export default LocationDisplay;
