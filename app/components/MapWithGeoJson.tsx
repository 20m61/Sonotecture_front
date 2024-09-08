'use client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { ViewStateChangeParameters } from '@deck.gl/core';
import * as Tone from 'tone'; // Tone.jsをインポート

const INITIAL_VIEW_STATE = {
  latitude: 35.6895, // 初期の緯度（東京）
  longitude: 139.6917, // 初期の経度
  zoom: 18, // ズームレベル
  bearing: 0, // 方角
  pitch: 60, // ピッチ（カメラの傾き）
};

const MapWithGeoJson = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [latitude, setLatitude] = useState(INITIAL_VIEW_STATE.latitude);
  const [longitude, setLongitude] = useState(INITIAL_VIEW_STATE.longitude);
  const [heading, setHeading] = useState(0); // 方角
  const [error, setError] = useState<string | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [buildingsWithin8km, setBuildingsWithin8km] = useState<any[]>([]);

  // GeoJSONデータを読み込む
  useEffect(() => {
    const fetchGeoJson = async () => {
      try {
        const response = await fetch('./data/building.geojson');
        if (!response.ok) {
          throw new Error('Failed to fetch GeoJSON data');
        }
        const data = await response.json();
        setGeojsonData(data);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
        setError('Failed to load GeoJSON data');
      }
    };
    fetchGeoJson();
  }, []);

  // デバイスの緯度、経度、方角をリアルタイムに取得
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (err) => setError('位置情報を取得できませんでした: ' + err.message),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setError('このブラウザでは位置情報がサポートされていません');
    }
  }, []);

  // デバイスの方角（heading）をリアルタイムに取得
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setHeading(event.alpha); // デバイスの方角（0-360度）
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    } else {
      setError('このデバイスでは方角がサポートされていません');
    }

    return () =>
      window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // 8km以内の建物をフィルタリング
  useEffect(() => {
    if (geojsonData && latitude && longitude) {
      const radius = 8; // 半径8km
      const R = 6371; // 地球の半径 (km)

      const filtered = geojsonData.features.filter((feature: any) => {
        const buildingCoords = feature.geometry.coordinates[0][0][0];
        const buildingLat = buildingCoords[1];
        const buildingLon = buildingCoords[0];

        const dLat = (buildingLat - latitude) * (Math.PI / 180);
        const dLon = (buildingLon - longitude) * (Math.PI / 180);
        const lat1 = latitude * (Math.PI / 180);
        const lat2 = buildingLat * (Math.PI / 180);

        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.sin(dLon / 2) *
            Math.sin(dLon / 2) *
            Math.cos(lat1) *
            Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c; // 距離 (km)

        return distance <= radius;
      });

      setBuildingsWithin8km(filtered);
    }
  }, [geojsonData, latitude, longitude]);

  // 音楽生成機能
  const generateMusicParameters = (height: number) => {
    const baseFrequency = 100; // ベースの周波数
    const pitch = baseFrequency + height * 2; // 高さに基づいて周波数を設定
    const duration = 1 + height / 100; // 音の長さを設定（建物の高さに応じて）
    return { pitch, duration };
  };

  // 音色を設定（建物の使用用途などで音色を変化させる）
  const getInstrument = (usage: string | undefined) => {
    if (usage?.includes('工場')) {
      return new Tone.MembraneSynth().toDestination(); // 工場なら打楽器系
    } else if (usage?.includes('事務所')) {
      return new Tone.Synth().toDestination(); // 事務所ならシンセサイザー系
    } else {
      return new Tone.FMSynth().toDestination(); // その他はFMシンセサイザー
    }
  };

  // 和音を生成
  const generateChord = (baseNote: number) => {
    return [baseNote, baseNote + 4, baseNote + 7]; // 基本の三和音
  };

  // 音を再生する
  const playSound = (pitch: number, duration: number, instrument: any) => {
    const chord = generateChord(pitch);
    chord.forEach((note, index) => {
      instrument.triggerAttackRelease(
        note,
        `${duration}s`,
        Tone.now() + index * 0.1
      );
    });
  };

  // 音楽を再生
  const handlePlayMusic = () => {
    let delay = 0;
    buildingsWithin8km.forEach((building, index) => {
      const height = building.properties.measuredHeight;
      const usage = building.properties.usage;
      if (height) {
        const { pitch, duration } = generateMusicParameters(height);
        const instrument = getInstrument(usage); // 音色を選択
        setTimeout(() => {
          playSound(pitch, duration, instrument);
        }, delay);
        delay += duration * 1000 + 100; // 各音の間隔を少し長めに設定
      }
    });
  };

  const layers = [
    new GeoJsonLayer({
      id: 'geojson-layer',
      data: geojsonData,
      pickable: true,
      stroked: false,
      filled: true,
      extruded: true, // 3D表示
      getFillColor: [160, 160, 180, 200],
      getLineColor: [0, 0, 0, 255],
      getRadius: 100,
      getElevation: (d: any) => d.properties.measuredHeight || 30,
    }),
  ];

  if (!geojsonData) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          zIndex: 1,
          maxWidth: '300px',
          maxHeight: '80vh', // パネルの高さ制限
          overflowY: 'auto', // 縦スクロールを追加
        }}
      >
        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>現在の情報</h2>
        <p>緯度: {latitude.toFixed(6)}</p>
        <p>経度: {longitude.toFixed(6)}</p>
        <p>方角: {heading.toFixed(2)}°</p>
        <h3 style={{ fontSize: '16px', marginTop: '20px' }}>
          近くの建物（8km以内）
        </h3>
        <ul>
          {buildingsWithin8km.map((building, index) => (
            <li key={index}>
              {building.properties.measuredHeight
                ? `高さ: ${building.properties.measuredHeight}m`
                : '高さ不明'}
            </li>
          ))}
        </ul>
        <button
          style={{
            padding: '10px',
            marginTop: '20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            borderRadius: '5px',
          }}
          onClick={handlePlayMusic}
        >
          音楽を再生
        </button>
      </div>
      <DeckGL
        initialViewState={viewState}
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
