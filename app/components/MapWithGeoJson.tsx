'use client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { ViewStateChangeParameters } from '@deck.gl/core';
import * as Tone from 'tone'; // Tone.jsをインポート

const INITIAL_VIEW_STATE = {
  latitude: 35.6895, // 初期の緯度（東京）
  longitude: 139.6917, // 初期の経度
  zoom: 18, // 1メートルの高度に合わせたズームレベル
  bearing: 0, // 方角を設定
  pitch: 120, // 水平から5度上向きに設定
};

const MapWithGeoJson = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [latitude, setLatitude] = useState(INITIAL_VIEW_STATE.latitude);
  const [longitude, setLongitude] = useState(INITIAL_VIEW_STATE.longitude);
  const [error, setError] = useState<string | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [filteredBuildings, setFilteredBuildings] = useState<any[]>([]);
  const [buildingsWithin8km, setBuildingsWithin8km] = useState<any[]>([]);

  // GeoJSONデータをfetchで読み込む
  useEffect(() => {
    const fetchGeoJson = async () => {
      try {
        console.log('Fetching GeoJSON data...');
        const response = await fetch('./data/building.geojson'); // 絶対パスを確認
        if (!response.ok) {
          throw new Error('Failed to fetch GeoJSON data');
        }
        const data = await response.json();
        console.log('GeoJSON data loaded:', data); // データが正しく読み込まれたか確認
        setGeojsonData(data);
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
        setError('Failed to load GeoJSON data');
      }
    };
    fetchGeoJson();
  }, []);

  // 音楽生成機能
  const generateMusicParameters = (height: number) => {
    const baseFrequency = 100; // ベースの周波数
    const pitch = baseFrequency + height * 2; // 高さに基づいて周波数を設定
    const duration = 1 + height / 100; // 音の長さを設定（建物の高さに応じて）
    return { pitch, duration };
  };

  const playSound = (pitch: number, duration: number) => {
    const synth = new Tone.Synth().toDestination();
    synth.triggerAttackRelease(pitch, `${duration}s`);
  };

  const handlePlayMusic = () => {
    let delay = 0;
    buildingsWithin8km.forEach((building, index) => {
      const height = building.properties.measuredHeight;
      if (height) {
        const { pitch, duration } = generateMusicParameters(height);
        setTimeout(() => {
          playSound(pitch, duration);
        }, delay);
        delay += duration * 1000 + 100; // 各音の間隔を少し長めに設定（音の再生時間 + 100ms）
      }
    });
  };

  // 緯度経度と8km以内の建物をフィルタリング
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
      console.log('Filtered Buildings within 8km:', filtered); // フィルタリング結果をコンソールに出力
    }
  }, [geojsonData, latitude, longitude]);

  if (!geojsonData) {
    return <div>Loading...</div>;
  }

  const layers = [
    new GeoJsonLayer({
      id: 'geojson-layer',
      data: geojsonData,
      pickable: true,
      stroked: false,
      filled: true,
      extruded: true, // 3Dに表示
      pointType: 'circle',
      getFillColor: [160, 160, 180, 200],
      getLineColor: [0, 0, 0, 255],
      getRadius: 100,
      getElevation: 30,
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
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={handlePlayMusic}>音楽を再生</button>
        <h4>8km以内の建物リスト</h4>
        <ul>
          {buildingsWithin8km.map((building, index) => (
            <li key={index}>
              {building.properties.measuredHeight
                ? `高さ: ${building.properties.measuredHeight}m`
                : '高さ不明'}
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
