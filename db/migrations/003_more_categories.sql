-- Migration 003: Tambah 10 kategori usaha UMKM umum

ALTER TABLE businesses
  MODIFY COLUMN category ENUM(
    'barbershop',
    'salon',
    'bengkel',
    'studio_foto',
    'klinik_kecantikan',
    'spa_pijat',
    'klinik_gigi',
    'laundry',
    'service_elektronik',
    'pet_shop',
    'kursus_les',
    'jahit_tailor',
    'olahraga_lapangan',
    'katering_kue',
    'lainnya'
  ) NOT NULL;

