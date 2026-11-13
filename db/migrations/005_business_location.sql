-- Migration 005: Koordinat lokasi UMKM untuk peta (Leaflet + OpenStreetMap)

ALTER TABLE businesses
  ADD COLUMN latitude  DECIMAL(9,6) NULL AFTER address,
  ADD COLUMN longitude DECIMAL(9,6) NULL AFTER latitude;

