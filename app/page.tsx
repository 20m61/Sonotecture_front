'use client';

import React from 'react';
import MapWithGeoJson from './components/MapWithGeoJson';

const Page = () => {
  return (
    <main style={{ height: '100vh', width: '100vw' }}>
      <MapWithGeoJson />
    </main>
  );
};

export default Page;
