'use client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { ViewStateChangeParameters } from '@deck.gl/core';
import * as Tone from 'tone';

const INITIAL_VIEW_STATE = {
  latitude: 35.6895, // 東京
  longitude: 139.6917,
  zoom: 12,
  bearing: 0,
  pitch: 0,
};

const MapWithGeoJson = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [latitude, setLatitude] = useState(INITIAL_VIEW_STATE.latitude);
  const [longitude, setLongitude] = useState(INITIAL_VIEW_STATE.longitude);
  const [heading, setHeading] = useState(INITIAL_VIEW_STATE.bearing);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [filteredBuildings, setFilteredBuildings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // GeoJSONデータの取得
  useEffect(() => {
    const fetchGeoJson = async () => {
      try {
        const response = await fetch('./data/building.geojson');
        if (!response.ok) {
          throw new Error('GeoJSONデータの読み込みに失敗しました');
        }
        const data = await response.json();
        setGeojsonData(data);
      } catch (error) {
        setError('GeoJSONデータの読み込みに失敗しました');
      }
    };
    fetchGeoJson();
  }, []);

  // 位置情報と方角の取得
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
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
  }, []);

  // 向き（方位）取得の許可を求める
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
          setError('An unknown error occurred during device orientation.');
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

  // 音楽生成のための関数
  const playSound = (frequency: number) => {
    const synth = new Tone.Synth().toDestination();
    synth.triggerAttackRelease(frequency, '8n');
  };

  const generateMusicFromBuildings = (buildings: any[]) => {
    Tone.Transport.start();
    buildings.forEach((building, index) => {
      const height = building.properties?.measuredHeight;
      if (height && isPlaying) {
        const frequency = 100 + height * 2;
        Tone.Transport.schedule((time) => {
          playSound(frequency);
        }, index * 0.5);
      }
    });
  };

  // 音楽再生の切り替え
  const toggleMusic = () => {
    setIsPlaying((prev) => !prev);
    if (!isPlaying) {
      Tone.start();
    }
  };

  // 距離計算
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const toRadians = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // 地球の半径 (km)
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 建物データのフィルタリングと音楽生成
  useEffect(() => {
    if (geojsonData) {
      const filtered = geojsonData.features.filter((feature: any) => {
        const buildingCoords = feature.geometry.coordinates[0][0][0]; // 最初の座標を取得
        const distance = calculateDistance(
          latitude,
          longitude,
          buildingCoords[1],
          buildingCoords[0]
        );
        return distance <= 8;
      });
      setFilteredBuildings(filtered);
      if (isPlaying) {
        generateMusicFromBuildings(filtered);
      }
    }
  }, [geojsonData, latitude, longitude, heading, isPlaying]);

  // DeckGLのレイヤー設定
  const layers = [
    new GeoJsonLayer({
      id: 'geojson-layer',
      data: geojsonData,
      pickable: true,
      stroked: false,
      filled: true,
      extruded: true,
      getFillColor: [160, 160, 180, 200],
      getElevation: (d: any) => d.properties.measuredHeight || 0,
    }),
  ];

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          zIndex: 1,
        }}
      >
        <p>Latitude: {latitude.toFixed(6)}</p>
        <p>Longitude: {longitude.toFixed(6)}</p>
        <p>Heading: {heading !== null ? Math.round(heading) : 'N/A'}°</p>
        <button
          onClick={handlePermissionRequest}
          style={{ marginTop: '10px', padding: '10px 20px' }}
        >
          Enable Orientation
        </button>
        <button
          onClick={toggleMusic}
          style={{
            marginTop: '10px',
            padding: '10px 20px',
            backgroundColor: isPlaying ? 'red' : 'green',
            color: 'white',
          }}
        >
          {isPlaying ? 'Stop Music' : 'Play Music'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <h4>8km以内の建物</h4>
        <ul>
          {filteredBuildings.map((building, index) => (
            <li key={index}>
              {building.properties.name || '不明'} - 高さ:{' '}
              {building.properties.measuredHeight || '不明'}m
            </li>
          ))}
        </ul>
      </div>
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={(params: ViewStateChangeParameters<any>) =>
          setViewState(params.viewState)
        }
      />
    </div>
  );
};

export default MapWithGeoJson;
