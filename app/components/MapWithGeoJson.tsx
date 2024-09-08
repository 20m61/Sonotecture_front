'use client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { ViewStateChangeParameters } from '@deck.gl/core';
import * as Tone from 'tone'; // 音楽生成ライブラリをインポート

const INITIAL_VIEW_STATE = {
  latitude: 35.6895, // 東京
  longitude: 139.6917,
  zoom: 12,
  bearing: 0, // 初期の方角
  pitch: 0, // 初期のカメラ角度
};

const MapWithGeoJson = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [latitude, setLatitude] = useState(INITIAL_VIEW_STATE.latitude);
  const [longitude, setLongitude] = useState(INITIAL_VIEW_STATE.longitude);
  const [heading, setHeading] = useState(INITIAL_VIEW_STATE.bearing);
  const [error, setError] = useState<string | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [filteredBuildings, setFilteredBuildings] = useState<any[]>([]);
  const [iOSPermissionRequested, setIOSPermissionRequested] = useState(false);

  // GeoJSONデータを読み込む
  useEffect(() => {
    const fetchGeoJson = async () => {
      try {
        const response = await fetch('./data/building.geojson');
        if (!response.ok) {
          throw new Error('GeoJSONのデータ読み込みに失敗しました');
        }
        const data = await response.json();
        setGeojsonData(data);
      } catch (error) {
        console.error('GeoJSONの読み込みエラー:', error);
        setError('GeoJSONのデータ読み込みに失敗しました');
      }
    };
    fetchGeoJson();
  }, []);

  // 方角の取得（iOS向けの許可リクエスト）
  const handleOrientationPermission = async () => {
    setIOSPermissionRequested(true); // 許可リクエストがされたことを記録

    if (
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as any
        ).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          setError('デバイス方角の許可が拒否されました');
        }
      } catch (error) {
        setError('デバイス方角の許可が拒否されました');
      }
    } else {
      // 権限リクエストが不要なブラウザ
      window.addEventListener('deviceorientation', handleOrientation);
    }
  };

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null && typeof event.alpha === 'number') {
      setHeading(event.alpha); // 方角を更新
      setViewState((prevState) => ({
        ...prevState,
        bearing: event.alpha ?? prevState.bearing, // 地図の回転を更新
      }));
    }
  };

  // ユーザーの現在位置を取得する
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setViewState((prevState) => ({
            ...prevState,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
        },
        (err) => {
          setError(`位置情報エラー: ${err.message}`);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setError('このブラウザは位置情報をサポートしていません');
    }
  }, []);

  // 高さに基づいた音楽生成
  const playSound = (frequency: number, duration: number) => {
    const synth = new Tone.Synth().toDestination();
    synth.triggerAttackRelease(frequency, duration);
  };

  const generateMusicFromBuildings = (buildings: any[]) => {
    buildings.forEach((building, index) => {
      const height = building.properties?.measuredHeight;
      if (height) {
        const frequency = 100 + height * 2; // 高さに応じて周波数を設定
        const duration = 0.5; // 0.5秒の長さ
        setTimeout(() => {
          playSound(frequency, duration);
        }, index * 500); // 音を0.5秒ごとに鳴らす
      }
    });
  };

  // 8km以内の建物をフィルタリング
  useEffect(() => {
    if (geojsonData) {
      const filtered = geojsonData.features.filter((feature: any) => {
        const buildingCoords = feature.geometry.coordinates[0][0];
        const distance = calculateDistance(
          latitude,
          longitude,
          buildingCoords[1],
          buildingCoords[0]
        );
        return distance <= 8; // 8km以内の建物を取得
      });
      setFilteredBuildings(filtered);
      generateMusicFromBuildings(filtered);
    }
  }, [geojsonData, latitude, longitude, heading]);

  // 距離計算
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const toRadians = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // 地球の半径（km）
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // 距離（km）
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
        <p>Heading: {heading.toFixed(2)}°</p>
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

      {!iOSPermissionRequested && (
        <button
          onClick={handleOrientationPermission}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            padding: '10px 20px',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          iOSで方角の許可をリクエスト
        </button>
      )}

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
