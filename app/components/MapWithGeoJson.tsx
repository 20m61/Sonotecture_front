'use client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { ViewStateChangeParameters } from '@deck.gl/core'; // ViewStateChangeParametersのインポート

const INITIAL_VIEW_STATE = {
  latitude: 35.6895, // 初期の緯度（東京）
  longitude: 139.6917, // 初期の経度
  zoom: 40, // 1メートルの高度に合わせたズームレベル
  bearing: 0, // 方角を設定
  pitch: 120, // 水平から5度上向きに設定
};

const MapWithGeoJson = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [latitude, setLatitude] = useState(INITIAL_VIEW_STATE.latitude);
  const [longitude, setLongitude] = useState(INITIAL_VIEW_STATE.longitude);
  const [heading, setHeading] = useState(INITIAL_VIEW_STATE.bearing);
  const [error, setError] = useState<string | null>(null);
  const [geojsonData, setGeojsonData] = useState(null); // GeoJSONデータを状態として保持

  // GeoJSONデータをfetchで読み込む
  useEffect(() => {
    const fetchGeoJson = async () => {
      try {
        const response = await fetch('/data/building.geojson'); // publicディレクトリ内のファイルを参照
        if (!response.ok) {
          throw new Error('Failed to fetch GeoJSON data');
        }
        const data = await response.json();
        setGeojsonData(data);
      } catch (error) {
        setError('Failed to load GeoJSON data');
      }
    };
    fetchGeoJson();
  }, []);

  // 緯度経度と方角のリアルタイム取得
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const altitudeOffset = 0.000009; // 約1メートルの高度調整（緯度経度に相当）

          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);

          // viewStateを更新して地図をユーザーの位置と1m上に移動
          setViewState((prevState) => ({
            ...prevState,
            latitude: position.coords.latitude + altitudeOffset,
            longitude: position.coords.longitude,
          }));
        },
        (err) => {
          setError(`Location error: ${err.message}`);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId); // クリーンアップ
      };
    } else {
      setError('Geolocation is not supported by this browser.');
    }

    // iOS向けのDeviceOrientationEvent.requestPermissionの処理
    const handleOrientationPermission = async () => {
      // requestPermissionが存在するかをチェック
      if (
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        try {
          const permission = await (
            DeviceOrientationEvent as any
          ).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } catch (error) {
          setError('Device orientation permission denied');
        }
      } else {
        // requestPermissionがない場合は通常の処理
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null && typeof event.alpha === 'number') {
        setHeading(event.alpha); // デバイスの方角を取得

        // viewStateを更新して地図を回転させる
        setViewState((prevState) => ({
          ...prevState,
          bearing: event.alpha ?? prevState.bearing, // nullチェックし、既存の値を維持
        }));
      }
    };

    handleOrientationPermission(); // 権限をリクエスト

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // GeoJSONデータが読み込まれていない場合は何も表示しない
  if (!geojsonData) {
    return <div>Loading...</div>;
  }

  // DeckGLにGeoJSONデータを表示するレイヤー
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
      {/* 緯度・経度・方角を表示する部分 */}
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
      </div>

      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        // viewStateを取得して更新
        onViewStateChange={(params: ViewStateChangeParameters<any>) =>
          setViewState(params.viewState)
        }
      />
    </div>
  );
};

export default MapWithGeoJson;
