'use client';
import React, {useEffect,useRef,useState} from 'react';
import type {Store} from '../lib/types';
export default function RetailMap({stores,compact=false,onSelect}:{stores:Store[];compact?:boolean;onSelect?:(s:Store)=>void}){
 const element=useRef<HTMLDivElement>(null);const [error,setError]=useState('');const [radius,setRadius]=useState(false);
 useEffect(()=>{let map:import('leaflet').Map|undefined;let disposed=false;
 import('leaflet').then(L=>{if(disposed||!element.current)return;map=L.map(element.current,{zoomControl:!compact,scrollWheelZoom:!compact}).setView([-2.5,117.5],4);const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(map);tiles.on('tileerror',()=>setError('Basemap unavailable. Source coordinates remain visible.'));
 const valid=stores.filter(s=>typeof s.latitude==='number'&&typeof s.longitude==='number');const group=L.featureGroup(); valid.forEach(s=>{const marker=L.circleMarker([s.latitude!,s.longitude!],{radius:compact?4:6,color:'#fff',weight:1.5,fillColor:'#138a91',fillOpacity:.85});const popup=document.createElement('div');const strong=document.createElement('strong');strong.textContent=s.name;popup.append(strong,document.createElement('br'),document.createTextNode(`${s.storeId} · ${s.region||'Unassigned'}`));marker.bindPopup(popup);marker.on('click',()=>onSelect?.(s));group.addLayer(marker);if(radius)L.circle([s.latitude!,s.longitude!],{radius:2000,color:'#138a91',weight:1,fillOpacity:.035}).addTo(group);});group.addTo(map);if(valid.length)map.fitBounds(group.getBounds(),{padding:[24,24],maxZoom:10}); setTimeout(()=>map?.invalidateSize(),150);
 }).catch(()=>setError('Unable to initialize geographic map.'));
 return()=>{disposed=true;map?.remove();};},[stores,compact,radius,onSelect]);
 return <div className={`map-wrap ${compact?'compact':''}`}><div ref={element} className="retail-map"/>{!compact&&<button className="map-radius" onClick={()=>setRadius(!radius)}>{radius?'Hide':'Show'} 2 km coverage radius</button>}<div className="map-legend"><span className="dot"/> Source-reported store coordinates · not field verified</div>{error&&<div className="map-error">{error}</div>}</div>;
}
