'use client';

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { ViewStateChangeParameters } from '@deck.gl/core';
import * as Tone from 'tone'; // Tone.jsをインポート

const INITIAL_VIEW_STATE = {
  latitude: 35.6895, // 初期の緯度（東京）
  longitude: 139.6917, // 初期の経度
  zoom: 10, // 1メートルの高度に合わせたズームレベル
  bearing: 0, // 方角を設定
  pitch: 210, // 水平から5度上向きに設定
};

const MapWithGeoJson = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [latitude, setLatitude] = useState(INITIAL_VIEW_STATE.latitude);
  const [longitude, setLongitude] = useState(INITIAL_VIEW_STATE.longitude);
  const [heading, setHeading] = useState(INITIAL_VIEW_STATE.bearing);
  const [error, setError] = useState<string | null>(null);
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [filteredBuildings, setFilteredBuildings] = useState<any[]>([]);
  const [iOSPermissionRequested, setIOSPermissionRequested] = useState(false); // iOS用のフラグ

  // GeoJSONデータをfetchで読み込む
  useEffect(() => {
    const fetchGeoJson = async () => {
      try {
        console.log('Fetching GeoJSON data...');
        const response = await fetch('/data/building.geojson'); // 絶対パスを確認
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
  const createMusicFromBuildings = (buildings: any[]) => {
    // Tone.jsを初期化
    const synth = new Tone.Synth().toDestination();

    // ここで建物の高さなどを音楽パラメータに変換
    buildings.forEach((building, index) => {
      const height = building.properties.height || 50; // 建物の高さ（高さが不明の場合は50を使用）
      const frequency = 100 + height * 2; // 高さに基づいて周波数を設定
      const duration = '8n'; // 音の長さを設定

      // 音を再生 (ランダムな時間差で)
      Tone.Transport.scheduleOnce((time) => {
        synth.triggerAttackRelease(frequency, duration, time);
      }, index * 0.5); // 建物ごとに0.5秒の間隔を空けて再生
    });

    // Tone.jsのタイムラインをスタート
    Tone.Transport.start();
  };

  // 緯度経度と方角のリアルタイム取得
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const altitudeOffset = 0.000009;

          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);

          console.log(
            `Current position - Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`
          );

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
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  }, []);

  // iOS向けの方角取得ボタン
  const handleOrientationPermission = async () => {
    setIOSPermissionRequested(true); // ボタンを押したフラグを設定

    if (
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        console.log('Requesting device orientation permission...');
        const permission = await (
          DeviceOrientationEvent as any
        ).requestPermission();
        if (permission === 'granted') {
          console.log('Permission granted.');
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          console.error('Device orientation permission denied');
          setError('Device orientation permission denied');
        }
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        setError('Device orientation permission denied');
      }
    } else {
      console.log('No need for device orientation permission.');
      // 権限リクエストが不要なブラウザ用の処理
      window.addEventListener('deviceorientation', handleOrientation);
    }
  };

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.alpha !== null && typeof event.alpha === 'number') {
      console.log('Device orientation detected: ', event.alpha);
      setHeading(event.alpha); // デバイスの方角を取得

      // viewStateを更新して地図を回転させる
      setViewState((prevState) => ({
        ...prevState,
        bearing: event.alpha ?? prevState.bearing,
      }));
    }
  };

  // 建物をフィルタリングする
  useEffect(() => {
    if (geojsonData && latitude && longitude && heading !== null) {
      const range = 30; // 方角の範囲（前方30度）

      const filtered = geojsonData.features.filter((feature: any) => {
        const buildingCoords = feature.geometry.coordinates;
        const bearing = calculateBearing(
          latitude,
          longitude,
          buildingCoords[1],
          buildingCoords[0]
        );
        return Math.abs(bearing - heading) <= range;
      });

      setFilteredBuildings(filtered);
      console.log('Filtered Buildings:', filtered); // フィルタリング結果をコンソールに出力

      // 音楽を更新
      createMusicFromBuildings(filtered);
    }
  }, [geojsonData, latitude, longitude, heading]);

  // ベアリング（緯度経度から方角を計算）
  const calculateBearing = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const toRadians = (deg: number) => deg * (Math.PI / 180);
    const toDegrees = (rad: number) => rad * (180 / Math.PI);
    const dLon = toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
    const x =
      Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
      Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLon);
    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
  };

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
        <p>Heading: {heading.toFixed(2)}°</p>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <h4>方角の範囲内の建物リスト</h4>
        <ul>
          {filteredBuildings.map((building, index) => (
            <li key={index}>
              {building.properties.name || 'No Name'} - 高さ:{' '}
              {building.properties.height || '不明'}m
            </li>
          ))}
        </ul>
      </div>

      {!iOSPermissionRequested && (
        <button
          onClick={handleOrientationPermission}
          style={{
            position: 'fixed', // 画面に固定
            bottom: '10%', // 下から10%の位置
            left: '50%', // 左右の中央
            transform: 'translateX(-50%)', // 完全な中央に移動
            padding: '15px 30px',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
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
