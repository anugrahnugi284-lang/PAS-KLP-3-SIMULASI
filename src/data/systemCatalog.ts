export type NodeKey = 'mic' | 'mixer' | 'amp' | 'spk';
export type SensorKey = 'sound' | 'current' | 'temp';
export type ComponentKey =
  | NodeKey
  | SensorKey
  | 'mic_ptt'
  | 'mic_grille'
  | 'mic_diaphragm'
  | 'mic_magnet'
  | 'mixer_preamp'
  | 'mixer_priority'
  | 'mixer_faders'
  | 'amp_toroid'
  | 'amp_heatsink'
  | 'amp_mosfet'
  | 'amp_protect'
  | 'amp_trafo100v'
  | 'spk_trafo'
  | 'spk_driver'
  | 'spk_cone';

export type FaultType = 'short' | 'overload' | null;
export type CameraPreset = 'overview' | 'closeup' | 'sensors';

export interface SimParams {
  ptt: boolean;
  bgm: boolean;
  alarm: boolean;
  explode: boolean;
  casingOpen: Record<NodeKey, boolean>;
  gain: number;        // 0.10 .. 1.00
  eq: number;          // -12 .. +12 dB
  fader: number;       // 0.00 .. 1.00
  atten: number;       // 0.00 .. 1.00
  cableMeters: number; // 10 .. 400 m
  tapWatts: 3 | 6 | 15;
  spkCount: number;    // 1 .. 6
  fault: FaultType;
}

export interface TelemetryState {
  tempC: number;
  soundDb: number;
  currentA: number;
  priorityActive: boolean;
  protectTripped: boolean;
  totalLoadWatts: number;
  lineVoltageV: number;
  cableLossPct: number;
  soundTriggered: boolean;
}

export interface InspectorEntry {
  kind: 'node' | 'component' | 'sensor';
  key: ComponentKey;
  parentUnit: NodeKey;
  kicker: string;
  title: string;
  photo: string;
  caption: string;
  explanation: string;
  workingPrinciple: string;
  signalFlow: string;
  items: string[];
  cam: [number, number, number];
  target: [number, number, number];
}

export const INITIAL_SIM_PARAMS: SimParams = {
  ptt: false,
  bgm: true,
  alarm: false,
  explode: false,
  casingOpen: {
    mic: true,
    mixer: true,
    amp: true,
    spk: true,
  },
  gain: 0.6,
  eq: 0,
  fader: 0.75,
  atten: 0.7,
  cableMeters: 120,
  tapWatts: 6,
  spkCount: 3,
  fault: null,
};

export const INITIAL_TELEMETRY: TelemetryState = {
  tempC: 38.0,
  soundDb: 54.0,
  currentA: 1.56,
  priorityActive: false,
  protectTripped: false,
  totalLoadWatts: 18,
  lineVoltageV: 68,
  cableLossPct: 2.6,
  soundTriggered: false,
};

export function computeTelemetryStep(
  params: SimParams,
  prevTempC: number,
  dt: number
): TelemetryState {
  const priorityActive = params.ptt || params.alarm;
  const activeAudio =
    (params.ptt ? 1.0 : 0.0) +
    (params.alarm ? 1.2 : 0.0) +
    (!priorityActive && params.bgm ? 0.55 : 0.0);

  const loadFactor = (params.tapWatts / 15) * (params.spkCount / 6) * params.atten;
  const soundDb = Number(
    (35 + Math.min(65, activeAudio * 28 * (0.5 + params.gain * 0.6))).toFixed(1)
  );
  const soundTriggered = soundDb >= 58 || priorityActive;

  let currentA = 0;
  let protectTripped = false;

  if (params.fault === 'short') {
    currentA = 18.5;
    protectTripped = true;
  } else if (params.fault === 'overload' || loadFactor > 0.88) {
    currentA = Number((7.5 + loadFactor * 6.5).toFixed(2));
    protectTripped = true;
  } else {
    currentA = Number((0.4 + loadFactor * 3.8 + activeAudio * 0.45).toFixed(2));
    protectTripped = false;
  }

  const targetTemp =
    28 + loadFactor * 36 + (protectTripped ? 18 : 0) + activeAudio * 4;
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.1);
  const alpha = 1 - Math.exp(-2.4 * clampedDt);
  const nextTemp = Number((prevTempC + (targetTemp - prevTempC) * alpha).toFixed(1));

  const cableLossPct = Number(((params.cableMeters / 400) * 8.5).toFixed(1));
  const lineVoltageV = protectTripped
    ? 0
    : Math.round(100 * params.atten * (1 - cableLossPct / 100));

  return {
    tempC: nextTemp,
    soundDb,
    currentA,
    priorityActive,
    protectTripped,
    totalLoadWatts: params.tapWatts * params.spkCount,
    lineVoltageV,
    cableLossPct,
    soundTriggered,
  };
}

const PHOTOS = {
  mic: '/src/assets/images/device_paging_mic_1795605221981.jpg',
  mixer: '/src/assets/images/device_preamp_mixer_1795605221624.jpg',
  amp: '/src/assets/images/device_power_amp_1795605223184.jpg',
  spk: '/src/assets/images/device_ceiling_speaker_1795605222868.jpg',
  soundSensor: '/src/assets/images/sensor_sound_module_1795604721220.jpg',
  currentSensor: '/src/assets/images/sensor_acs712_current_1795604721254.jpg',
  tempSensor: '/src/assets/images/sensor_temp_probe_1795604720749.jpg',
};

export const UNIT_COMPONENTS: Record<NodeKey, { key: ComponentKey; label: string }[]> = {
  mic: [
    { key: 'mic', label: 'Unit Utuh' },
    { key: 'mic_ptt', label: 'Tombol PTT' },
    { key: 'mic_grille', label: 'Grille & Foam' },
    { key: 'mic_diaphragm', label: 'Diafragma & Coil' },
    { key: 'mic_magnet', label: 'Magnet & Housing' },
    { key: 'sound', label: 'Sensor Suara' },
  ],
  mixer: [
    { key: 'mixer', label: 'Unit Utuh' },
    { key: 'mixer_preamp', label: 'Gain & Tone EQ' },
    { key: 'mixer_priority', label: 'Relay Prioritas' },
    { key: 'mixer_faders', label: 'Fader & Buffer' },
  ],
  amp: [
    { key: 'amp', label: 'Unit Utuh' },
    { key: 'amp_toroid', label: 'Toroid & Elco' },
    { key: 'amp_mosfet', label: 'MOSFET Daya' },
    { key: 'amp_heatsink', label: 'Heatsink Sirip' },
    { key: 'amp_protect', label: 'Sirkuit Proteksi' },
    { key: 'amp_trafo100v', label: 'Trafo 100V Line' },
    { key: 'temp', label: 'Sensor Suhu' },
    { key: 'current', label: 'Sensor Arus ACS712' },
  ],
  spk: [
    { key: 'spk', label: 'Unit Utuh' },
    { key: 'spk_trafo', label: 'Trafo Matching' },
    { key: 'spk_driver', label: 'Coil & Magnet' },
    { key: 'spk_cone', label: 'Cone & Grille' },
  ],
};

export const COMPONENT_CATALOG: Record<ComponentKey, InspectorEntry> = {
  // === 1. PAGING MICROPHONE & SUB-COMPONENTS ===
  mic: {
    kind: 'node',
    key: 'mic',
    parentUnit: 'mic',
    kicker: 'Unit 1 · Transduser Input (7 Lapisan Kapsul)',
    title: 'Paging Microphone (Kapsul Dinamis)',
    photo: PHOTOS.mic,
    caption: 'Foto Referensi: Desktop Gooseneck Paging Microphone',
    explanation:
      'Perangkat input utama operator untuk menyampaikan pengumuman suara (paging) ke seluruh zona speaker gedung.',
    workingPrinciple:
      'Mengubah energi mekanik gelombang suara vokal menjadi sinyal listrik analog lemah (orde 1–5 mV) melalui induksi elektromagnetik pada kumparan suara di dalam medan magnet permanen.',
    signalFlow:
      'Gelombang Akustik -> Grille & Foam -> Diafragma & Voice Coil -> Magnet Permanen -> Kabel Sinyal Lemah -> Pre-Amp / Mixer.',
    items: [
      'Gunakan tombol Tutup/Buka Casing untuk melihat kapsul mikrofon dalam kondisi tertutup windscreen atau terbuka penuh.',
      'Klik setiap bagian kapsul, tombol PTT, atau Sensor Suara untuk memeriksa detail fungsi masing-masing.',
    ],
    cam: [-14, 5.8, 10.5],
    target: [-14, 1.8, 0],
  },
  mic_ptt: {
    kind: 'component',
    key: 'mic_ptt',
    parentUnit: 'mic',
    kicker: 'Paging Mic · Kontrol Akses',
    title: 'Sakelar PTT (Push-To-Talk) & Basis Meja',
    photo: PHOTOS.mic,
    caption: 'Tombol PTT pada Base Aluminium Paging Microphone',
    explanation:
      'Sakelar kendali fisik pada dudukan mikrofon meja yang membuka jalur mikrofon sekaligus mengirim sinyal pemicu prioritas ke Mixer.',
    workingPrinciple:
      'Saat ditekan (ON), kontak sakelar menghubungkan jalur sinyal kapsul dinamis dan mengirim tegangan logika/kontrol ke Relay Priority Override agar BGM diredam otomatis.',
    signalFlow:
      'Tekan PTT -> LED Hijau Menyala -> Sinyal Kontrol Prioritas -> Relay Priority Override Mixer (BGM Muted).',
    items: [
      'Basis pemberat menjaga kestabilan gooseneck dan meredam getaran meja.',
      'Terhubung langsung ke kontrol simulasi tombol PTT Mic.',
    ],
    cam: [-14, 4.2, 6.2],
    target: [-14, 0.85, 0.5],
  },
  mic_grille: {
    kind: 'component',
    key: 'mic_grille',
    parentUnit: 'mic',
    kicker: 'Paging Mic · Lapisan 1–2',
    title: 'Grille Logam Pelindung & Foam Akustik',
    photo: PHOTOS.mic,
    caption: 'Pelindung Mekanis Grille & Busa Pop-Filter Akustik',
    explanation:
      'Dua lapisan terluar kapsul mikrofon yang melindungi diafragma rapuh dari benturan fisik, debu, serta hembusan napas operator.',
    workingPrinciple:
      'Anyaman kawat baja meneruskan gelombang suara secara merata, sementara pori-pori foam akustik menyebar tekanan angin berlebih (pop noise huruf P, B, T) sebelum menyentuh membran.',
    signalFlow:
      'Tekanan Udara Suara -> Grille Logam (1) -> Foam Akustik (2) -> Diafragma Kapsul (3).',
    items: [
      'Mengurangi distorsi plosive tanpa melemahkan frekuensi vokal 300 Hz – 4 kHz.',
      'Aktifkan Explode untuk melihat pemisahan antara grille, busa, dan diafragma.',
    ],
    cam: [-15.2, 4.6, 5.2],
    target: [-14.7, 3.2, -0.5],
  },
  mic_diaphragm: {
    kind: 'component',
    key: 'mic_diaphragm',
    parentUnit: 'mic',
    kicker: 'Paging Mic · Lapisan 3–4',
    title: 'Diafragma Membran & Voice Coil (Kumparan Suara)',
    photo: PHOTOS.mic,
    caption: 'Elemen Transduser Bergetar (Diafragma & Kumparan Tembaga)',
    explanation:
      'Jantung transduser mikrofon yang mengonversi getaran udara menjadi gerak mekanis dan membangkitkan tegangan listrik bolak-balik (AC).',
    workingPrinciple:
      'Gelombang suara menggetarkan membran poliester tipis (diafragma) yang menempel langsung pada lilitan kawat tembaga halus (voice coil) sehingga bergerak maju-mundur memotong fluks magnet.',
    signalFlow:
      'Getaran Udara -> Osilasi Diafragma (3) -> Gerakan Voice Coil (4) -> GGL Induksi mV -> Kabel Output Mic.',
    items: [
      'Amplitudo getaran pada model 3D berosilasi sesuai level dB Sensor Suara.',
      'Menghasilkan tegangan sangat lemah (orde milivolt) yang sensitif terhadap noise.',
    ],
    cam: [-14.2, 4.5, 5.0],
    target: [-14.1, 3.2, -0.5],
  },
  mic_magnet: {
    kind: 'component',
    key: 'mic_magnet',
    parentUnit: 'mic',
    kicker: 'Paging Mic · Lapisan 5–7',
    title: 'Magnet Permanen, Rumah Kapsul & Kabel Sinyal',
    photo: PHOTOS.mic,
    caption: 'Sirkuit Magnetik & Rumah Kapsul Dinamis',
    explanation:
      'Struktur stator kapsul yang menyediakan medan magnet tetap dan mengisolasi kapsul secara mekanis serta elektrik menuju kabel balanced.',
    workingPrinciple:
      'Berdasarkan Hukum Faraday (e = -N·dΦ/dt), medan magnet permanen tetap yang dipotong oleh gerakan voice coil menghasilkan tegangan listrik proporsional terhadap kecepatan getaran suara.',
    signalFlow:
      'Medan Magnet Permanen (5) + Induksi Voice Coil -> Housing Kapsul (6) -> Kabel Shielded (7) -> Input Mixer.',
    items: [
      'Housing menjaga celah udara (air gap) tetap presisi agar voice coil tidak bergesekan.',
      'Kabel shielded mencegah interferensi elektromagnetik sepanjang jalur mV.',
    ],
    cam: [-13.0, 4.5, 5.2],
    target: [-13.4, 3.2, -0.5],
  },
  sound: {
    kind: 'sensor',
    key: 'sound',
    parentUnit: 'mic',
    kicker: 'Sensor 1 · Deteksi Suara Input',
    title: 'Modul Sensor Suara (Kapsul Kondenser & LM393)',
    photo: PHOTOS.soundSensor,
    caption: 'Foto Asli: Modul Sensor Suara (Mic Kondenser, Trimpot 10K, IC LM393)',
    explanation:
      'Modul sensor akustik yang memantau intensitas tekanan suara di sekitar mikrofon paging dan mendeteksi apakah level suara melampaui ambang batas (threshold).',
    workingPrinciple:
      'Kapsul kondenser mengubah getaran suara menjadi tegangan analog, lalu komparator IC LM393 membandingkannya dengan referensi dari potensiometer biru 10K untuk memicu output digital DO dan pembacaan dB.',
    signalFlow:
      'Gelombang Akustik -> Kapsul Kondenser -> Komparator LM393 -> LED Trigger & Pin OUT -> Priority Logic & Osiloskop.',
    items: [
      'Simulasi Aktif: Cincin gelombang akustik bergerak masuk ke kapsul kondenser dan LED DO menyala saat > 58 dB atau PTT/Alarm aktif.',
      'Model 3D dibuat presisi: PCB biru, kapsul silver + felt hitam, trimpot biru 10K, IC LM393 8-pin, dan 3 pin header emas.',
    ],
    cam: [-16.0, 4.5, 4.8],
    target: [-15.8, 3.2, -0.5],
  },

  // === 2. PRE-AMPLIFIER / MIXER & SUB-COMPONENTS ===
  mixer: {
    kind: 'node',
    key: 'mixer',
    parentUnit: 'mixer',
    kicker: 'Unit 2 · Otak Sistem & Pengolah Sinyal (5 Blok PCB)',
    title: 'Pre-Amplifier / Mixer (19-Inch Rackmount)',
    photo: PHOTOS.mixer,
    caption: 'Foto Referensi: 19-Inch Rackmount PA Pre-Amplifier / Mixer',
    explanation:
      'Pusat kendali sinyal audio yang menyamakan level sinyal lemah mikrofon dengan sumber BGM/Alarm, mengatur karakter nada, dan menentukan prioritas penyiaran.',
    workingPrinciple:
      'Menguatkan sinyal mV dari mikrofon ke standar Line Level (~0,775V–1,23V RMS), mengatur kurva frekuensi via filter aktif, serta mengaktifkan relay pemutus BGM saat sinyal prioritas masuk.',
    signalFlow:
      'Input (Mic, BGM, Alarm) -> Gain/Pre-Amp -> EQ Tone -> Priority Override -> Master Fader -> Output Buffer (Line Level) -> Power Amp.',
    items: [
      'Buka atau tutup cover atas rackmount untuk melihat PCB hijau, knop EQ, Relay Prioritas, dan 4 fader kanal.',
      'Klik tiap blok PCB di dalam Mixer untuk penjelasan rinci.',
    ],
    cam: [-4.5, 6.8, 9.8],
    target: [-4.5, 1.0, 0],
  },
  mixer_preamp: {
    kind: 'component',
    key: 'mixer_preamp',
    parentUnit: 'mixer',
    kicker: 'Mixer · Blok 1–2 (Gain & Tone Control)',
    title: 'Tahap Pre-Amp Op-Amp & Tone Control (EQ)',
    photo: PHOTOS.mixer,
    caption: 'Blok Gain Awal & Potensiometer Pengatur Nada (Bass/Mid/Treble)',
    explanation:
      'Rangkaian penguat awal berderau rendah (low-noise) yang mengangkat sinyal mV mikrofon sekaligus membentuk keseimbangan frekuensi suara.',
    workingPrinciple:
      'Operational Amplifier (Op-Amp) menaikkan amplitudo hingga ratusan kali sesuai slider Gain, kemudian jaringan RC aktif pada potensiometer EQ menguatkan atau memotong frekuensi Bass, Mid, dan Treble.',
    signalFlow:
      'Sinyal Mic (mV) -> Penguat Op-Amp (Gain) -> Filter Aktif Bass/Mid/Treble (EQ) -> Jalur Mixing & Priority.',
    items: [
      'Menyesuaikan kejernihan vokal agar pengumuman mudah dipahami di ruangan bergema.',
      'Perubahan slider Gain dan EQ langsung terlihat pada segmen 2–3 Osiloskop.',
    ],
    cam: [-4.5, 4.8, 4.6],
    target: [-4.5, 1.4, -1.5],
  },
  mixer_priority: {
    kind: 'component',
    key: 'mixer_priority',
    parentUnit: 'mixer',
    kicker: 'Mixer · Blok 3 (Logika Prioritas)',
    title: 'Sirkuit Priority Override (Relay Prioritas)',
    photo: PHOTOS.mixer,
    caption: 'Relay Elektromekanis Pemutus / Peredam BGM Otomatis',
    explanation:
      'Gerbang logika pengaman siaran yang memastikan pengumuman darurat atau paging operator tidak pernah tertutup oleh musik latar (BGM).',
    workingPrinciple:
      'Ketika tombol PTT Mic atau Alarm aktif, kumparan relay terenergi (berpendar kuning/amber pada model 3D), memutus kontak jalur BGM dan menghubungkan jalur prioritas langsung ke bus utama.',
    signalFlow:
      'Trigger PTT / Alarm / Sensor Suara -> Kumparan Relay Prioritas -> Redam/Putus BGM -> Bus Mixing Utama.',
    items: [
      'Urutan prioritas tertinggi: (1) Alarm Darurat -> (2) Paging PTT -> (3) BGM.',
      'Status PRIORITY OVERRIDE langsung aktif di panel telemetri atas.',
    ],
    cam: [-4.5, 4.4, 4.2],
    target: [-4.5, 1.65, -0.65],
  },
  mixer_faders: {
    kind: 'component',
    key: 'mixer_faders',
    parentUnit: 'mixer',
    kicker: 'Mixer · Blok 4–5 (Mixing & Buffer)',
    title: 'Channel Fader Mixing & Output Buffer (Line Level)',
    photo: PHOTOS.mixer,
    caption: 'Motorized / Slide Fader Pencampur Kanal & Tahap Output Buffer',
    explanation:
      'Tahap penggabungan (summing) seluruh kanal input dengan pengatur level geser serta penstabil impedansi sebelum sinyal masuk ke Power Amplifier.',
    workingPrinciple:
      'Potensiometer geser (fader) mengatur proporsi tegangan tiap kanal ke penguat penjumlah (summing amplifier), lalu buffer output menjaga level standar ~1V dengan impedansi rendah agar kebal rugi kabel antar-rak.',
    signalFlow:
      'Kanal Terpilih -> Summing Master Fader -> Output Buffer (Line Level ~1V) -> Kabel Interkoneksi Power Amp.',
    items: [
      'Keempat fader bergerak dinamis menyesuaikan aliran dan level mixing simulasi.',
      'Mengontrol amplitudo segmen 3 (Line Level) pada osiloskop.',
    ],
    cam: [-4.5, 4.5, 5.5],
    target: [-4.5, 1.4, 1.1],
  },

  // === 3. POWER AMPLIFIER 100V LINE & SUB-COMPONENTS + 2 SENSORS ===
  amp: {
    kind: 'node',
    key: 'amp',
    parentUnit: 'amp',
    kicker: 'Unit 3 · Otot Sistem & 100V Line (6 Blok Daya)',
    title: 'Power Amplifier 100V Line',
    photo: PHOTOS.amp,
    caption: 'Foto Referensi: Sasis Terbuka Power Amplifier 100V Line',
    explanation:
      'Penguat daya tinggi yang melipatgandakan energi sinyal Line Level lalu menaikkan tegangannya ke standar distribusi 100V Line agar mampu menggerakkan banyak speaker jarak jauh.',
    workingPrinciple:
      'Energi listrik AC diturunkan dan disearahkan oleh trafo toroidal & elco menjadi DC berarus besar untuk menggerakkan MOSFET daya pada heatsink, kemudian dinaikkan kembali oleh trafo output 100V.',
    signalFlow:
      'Line Level -> Driver & MOSFET Daya (Suplai Toroid + Elco) -> Proteksi & Sensor ACS712 -> Trafo Step-Up 100V -> Kabel Distribusi.',
    items: [
      'Tutup atau buka cover atas 3U amplifier untuk melihat tata letak seluruh komponen daya dan kedua sensor.',
      'Klik langsung Trafo Toroid, Elco, MOSFET, Heatsink, Proteksi, Trafo 100V, Sensor Suhu, atau ACS712.',
    ],
    cam: [5.5, 7.6, 11.2],
    target: [5.5, 1.05, 0],
  },
  amp_toroid: {
    kind: 'component',
    key: 'amp_toroid',
    parentUnit: 'amp',
    kicker: 'Power Amp · Blok 1 (Catu Daya)',
    title: 'Dual Trafo Toroidal & Bank Kapasitor Elco',
    photo: PHOTOS.amp,
    caption: 'Catu Daya Linear: Dual Trafo Donat Tembaga & Bank Elco Filter',
    explanation:
      'Sumber energi utama amplifier yang mengubah tegangan listrik PLN menjadi suplai daya DC simetris berkapasitas arus tinggi dan bebas dengung.',
    workingPrinciple:
      'Trafo toroidal memiliki inti ferit berbentuk cincin yang meminimalkan kebocoran fluks magnet dan panas; arus AC sekunder disearahkan lalu diratakan riaknya oleh deretan kapasitor elektrolit (Elco) berkapasitas ribuan mikrofarad.',
    signalFlow:
      'Sumber AC Mains -> Dual Trafo Toroidal -> Penyearah & Bank Kapasitor Elco -> Rel Daya DC (+/- VCC) ke MOSFET.',
    items: [
      'Menjamin cadangan energi sesaat (headroom) saat dentuman bass atau sirine alarm puncak.',
      'Desain toroidal menekan interferensi medan magnet ke rangkaian sinyal audio.',
    ],
    cam: [3.2, 4.8, 5.8],
    target: [3.1, 0.9, 0],
  },
  amp_mosfet: {
    kind: 'component',
    key: 'amp_mosfet',
    parentUnit: 'amp',
    kicker: 'Power Amp · Blok 2–3 (Penguat Daya)',
    title: 'Deretan Transistor / MOSFET Daya (TO-247)',
    photo: PHOTOS.amp,
    caption: 'Transistor / MOSFET Daya Terpasang pada Tulang Heatsink',
    explanation:
      'Komponen semikonduktor aktif yang bertindak sebagai katup daya berkecepatan tinggi untuk memperkuat arus dan tegangan sinyal audio ratusan watt.',
    workingPrinciple:
      'Sinyal audio dari tahap driver memodulasi gerbang (Gate/Base) pasangan MOSFET komplementer sehingga arus besar dari bank Elco mengalir proporsional mengikuti bentuk gelombang audio asli.',
    signalFlow:
      'Sinyal Driver -> Gate MOSFET Daya + Suplai DC Elco -> Output Daya Audio (Arus Besar) -> Sirkuit Proteksi.',
    items: [
      'Menghasilkan disipasi panas tinggi sehingga punggung logamnya dibaut langsung ke tulang Heatsink.',
      'Dikendalikan oleh level Attenuator Penguat.',
    ],
    cam: [5.2, 4.6, 4.8],
    target: [5.4, 1.1, 0],
  },
  amp_heatsink: {
    kind: 'component',
    key: 'amp_heatsink',
    parentUnit: 'amp',
    kicker: 'Power Amp · Blok 4 (Manajemen Termal)',
    title: 'Heatsink Aluminium 14 Sirip',
    photo: PHOTOS.amp,
    caption: 'Sirip Pendingin Ekstrusi Aluminium & Area Probe Suhu',
    explanation:
      'Penyerap dan pembuang panas konveksi untuk menjaga suhu kerja MOSFET daya tetap di bawah batas aman silikon.',
    workingPrinciple:
      'Konduksi termal memindahkan panas dari badan MOSFET ke tulang aluminium tebal lalu menyebarkannya ke 14 sirip tipis agar luas permukaan kontak dengan udara meningkat drastis.',
    signalFlow:
      'Panas MOSFET Daya -> Konduksi Tulang Heatsink -> Pelepasan Kalor 14 Sirip -> Dipantau Langsung oleh Sensor Suhu Probe.',
    items: [
      'Pada simulasi 3D, warna sirip heatsink berpendar hangat hingga merah seiring kenaikan °C beban.',
      'Menempel langsung dengan ujung probe stainless DS18B20.',
    ],
    cam: [6.0, 5.0, 5.2],
    target: [6.1, 1.1, 0],
  },
  amp_protect: {
    kind: 'component',
    key: 'amp_protect',
    parentUnit: 'amp',
    kicker: 'Power Amp · Blok 5 (Keamanan Sistem)',
    title: 'Sirkuit Proteksi Relay & Indikator LED Protect',
    photo: PHOTOS.amp,
    caption: 'Modul Relay Proteksi Beban & LED Indikator Gangguan',
    explanation:
      'Sistem pemutus darurat otomatis yang melindungi transistor daya dan trafo output dari kerusakan fatal akibat korsleting kabel atau beban berlebih.',
    workingPrinciple:
      'Membaca sinyal umpan balik dari Sensor Arus ACS712 dan Sensor Suhu; bila terdeteksi arus hubung singkat (Short Circuit) atau Overload, relay langsung terbuka memutus jalur output dan menyalakan LED Protect merah.',
    signalFlow:
      'Umpan Balik ACS712 & Probe Suhu -> Logika Komparator Proteksi -> Relay Pemutus Output + LED Protect Merah.',
    items: [
      'Uji fitur ini dengan menekan tombol Short Circuit atau Overload, atau menaikkan jumlah speaker Tap 15W.',
      'Saat trip aktif, aliran partikel sinyal 3D terhenti dan berwarna merah.',
    ],
    cam: [7.8, 4.8, 5.6],
    target: [7.7, 0.9, 0.4],
  },
  amp_trafo100v: {
    kind: 'component',
    key: 'amp_trafo100v',
    parentUnit: 'amp',
    kicker: 'Power Amp · Blok 6 (Transformasi 100V Line)',
    title: 'Trafo Output Step-Up 100V Line',
    photo: PHOTOS.amp,
    caption: 'Transformator Step-Up 100V / 70V Constant Voltage Line',
    explanation:
      'Transformator audio berinti besi laminasi yang menaikkan tegangan sinyal keluaran amplifier menjadi jalur distribusi tegangan konstan 100V.',
    workingPrinciple:
      'Sesuai prinsip daya listrik P = V × I, menaikkan tegangan menuju 100V menurunkan arus yang mengalir di kabel distribusi gedung secara drastis sehingga rugi tegangan (voltage drop = I × R) pada kabel ratusan meter tetap minimal.',
    signalFlow:
      'Output MOSFET (via Relay & ACS712) -> Kumparan Primer -> Induksi Inti Besi -> Kumparan Sekunder 100V Line -> Kabel Gedung.',
    items: [
      'Memungkinkan banyak speaker disambung paralel dengan perhitungan total Watt <= kapasitas amplifier.',
      'Menaikkan amplitudo segmen 4 pada Osiloskop (warna kuning 100V Line).',
    ],
    cam: [9.4, 4.8, 5.2],
    target: [9.1, 1.0, 0.6],
  },
  temp: {
    kind: 'sensor',
    key: 'temp',
    parentUnit: 'amp',
    kicker: 'Sensor 2 · Pemantau Termal Heatsink',
    title: 'Sensor Suhu Probe Stainless (DS18B20)',
    photo: PHOTOS.tempSensor,
    caption: 'Foto Asli: Sensor Suhu Probe Stainless Steel Waterproof & Konektor 3-Pin',
    explanation:
      'Probe sensor suhu digital berujung tabung baja tahan karat yang ditempelkan pada sirip Heatsink untuk membaca temperatur aktual penguat daya.',
    workingPrinciple:
      'Panas dari sirip aluminium berpindah melalui selongsong stainless steel ke elemen semikonduktor DS18B20 di dalam ujung probe, menghasilkan pembacaan suhu digital (°C) berpresisi ±0,5°C.',
    signalFlow:
      'Panas Sirip Heatsink -> Ujung Probe Stainless -> Konversi Digital °C -> Telemetri Termal & Perlindungan Overheat.',
    items: [
      'Simulasi Aktif: Cincin aura termal pada collar probe berubah warna dari biru dingin -> kuning hangat -> merah panas mengikuti °C.',
      'Model 3D dibuat presisi: Tabung probe stainless, collar heksagonal 6-sisi, strain-relief hitam, kabel, dan konektor JST 3-pin.',
    ],
    cam: [7.2, 4.2, 4.2],
    target: [6.95, 1.22, 0.4],
  },
  current: {
    kind: 'sensor',
    key: 'current',
    parentUnit: 'amp',
    kicker: 'Sensor 3 · Pemantau Arus Beban',
    title: 'Modul Sensor Arus Hall-Effect (ACS712 20A)',
    photo: PHOTOS.currentSensor,
    caption: 'Foto Asli: Modul Sensor Arus Hall ACS712 dengan Terminal Beban IP+ / IP-',
    explanation:
      'Modul sensor arus non-kontak berbasis Efek Hall yang dipasang seri pada jalur output daya untuk mengukur besar arus beban speaker dalam satuan Ampere.',
    workingPrinciple:
      'Arus listrik yang mengalir melalui jalur tembaga antara terminal sekrup IP+ dan IP- menghasilkan medan magnet internal; IC Allegro ACS712 mendeteksi medan magnet ini dan mengubahnya menjadi tegangan proporsional pada pin OUT.',
    signalFlow:
      'Arus Beban (IP+ -> IP-) -> Medan Magnet Internal -> IC Hall ACS712 -> Pin OUT (Ampere) -> Pemicu Sirkuit Proteksi.',
    items: [
      'Simulasi Aktif: Cincin fluks magnetik Efek Hall berdenyut di atas IC ACS712 secepat besar arus (A), dan menyala merah saat Overload/Short.',
      'Model 3D dibuat presisi: PCB biru, IC SOIC-8 tengah, dua terminal sekrup biru (IP+/IP-) lengkap dengan baut & kabel beban, LED PWR merah, dan 3 pin header emas.',
    ],
    cam: [7.7, 4.0, 4.4],
    target: [7.7, 0.72, 1.2],
  },

  // === 4. CEILING SPEAKER & SUB-COMPONENTS ===
  spk: {
    kind: 'node',
    key: 'spk',
    parentUnit: 'spk',
    kicker: 'Unit 4 · Transduser Output (6 Lapisan Elektroakustik)',
    title: 'Ceiling Speaker (100V Line)',
    photo: PHOTOS.spk,
    caption: 'Foto Referensi: Ceiling Speaker 100V Line, Driver Magnet & Trafo Matching',
    explanation:
      'Perangkat keluaran akhir yang dipasang di plafon ruangan untuk mengonversi sinyal listrik tegangan tinggi 100V kembali menjadi gelombang bunyi akustik.',
    workingPrinciple:
      'Trafo matching menurunkan tegangan 100V sesuai pemilihan tap daya (3W/6W/15W) agar cocok dengan impedansi kumparan suara, lalu gaya Lorentz menggetarkan membran cone menghasilkan tekanan suara.',
    signalFlow:
      'Kabel 100V Line -> Trafo Matching (Tap 3W/6W/15W) -> Voice Coil & Magnet -> Spider & Cone -> Grille -> Gelombang Suara Ruangan.',
    items: [
      'Tutup atau buka rear fire-dome backcan speaker untuk melihat trafo matching dan unit driver di dalamnya.',
      'Slider Jumlah Speaker Paralel menambah atau mengurangi unit speaker paralel di area panggung.',
    ],
    cam: [15.5, 6.2, 10.5],
    target: [15.5, 1.9, 0],
  },
  spk_trafo: {
    kind: 'component',
    key: 'spk_trafo',
    parentUnit: 'spk',
    kicker: 'Ceiling Speaker · Lapisan 1',
    title: 'Trafo Matching 100V (Tap Daya 3W / 6W / 15W)',
    photo: PHOTOS.spk,
    caption: 'Transformator Step-Down Multi-Tap (3W / 6W / 15W)',
    explanation:
      'Transformator penyesuai impedansi dan daya pada bagian belakang speaker yang menentukan seberapa keras tiap titik speaker berbunyi.',
    workingPrinciple:
      'Memiliki beberapa sadapan lilitan primer (Tap 3W, 6W, 15W) untuk menurunkan tegangan tinggi 100V Line menjadi tegangan rendah berarus besar sesuai impedansi 4–8 Ohm voice coil speaker.',
    signalFlow:
      'Jalur 100V Line -> Selektor Tap (3W / 6W / 15W) -> Induksi Step-Down -> Terminal Voice Coil Driver.',
    items: [
      'Tap lebih besar (15W) menarik arus lebih tinggi per speaker yang langsung terbaca di Sensor ACS712.',
      'Menentukan kekuatan gelombang akustik keluaran speaker.',
    ],
    cam: [13.8, 4.4, 4.6],
    target: [14.4, 2.2, 0],
  },
  spk_driver: {
    kind: 'component',
    key: 'spk_driver',
    parentUnit: 'spk',
    kicker: 'Ceiling Speaker · Lapisan 2–4',
    title: 'Voice Coil, Magnet Permanen & Suspensi Spider',
    photo: PHOTOS.spk,
    caption: 'Motor Elektroakustik: Kumparan Suara, Magnet Ferit & Spider',
    explanation:
      'Rakitan motor elektromagnetik speaker yang mengubah arus AC audio dari trafo matching menjadi gerak bolak-balik mekanis.',
    workingPrinciple:
      'Arus bolak-balik melewati voice coil yang berada di celah magnet ferit permanen menghasilkan gaya Lorentz bolak-balik; pegas bergelombang (spider) menjaga posisi coil tetap sentris di tengah celah magnet.',
    signalFlow:
      'Output Trafo Matching -> Voice Coil (2) <-> Medan Magnet (3) -> Stabilisasi Spider (4) -> Dorong Membran Cone.',
    items: [
      'Menentukan efisiensi konversi energi listrik menjadi gaya dorong mekanis.',
      'Klik Explode untuk memisahkan komponen motor driver secara aksial.',
    ],
    cam: [15.3, 4.3, 4.8],
    target: [15.4, 2.2, 0],
  },
  spk_cone: {
    kind: 'component',
    key: 'spk_cone',
    parentUnit: 'spk',
    kicker: 'Ceiling Speaker · Lapisan 5–6',
    title: 'Diafragma Cone & Grille Logam Pelindung',
    photo: PHOTOS.spk,
    caption: 'Membran Cone Kerucut & Grille Perforasi Putih',
    explanation:
      'Permukaan pemancar akustik terdepan yang mendorong udara ruangan untuk menciptakan gelombang suara serta grille estetis pelindung plafon.',
    workingPrinciple:
      'Gerakan maju-mundur voice coil menggetarkan kerucut kertas/polipropilena (cone) sehingga menciptakan rapatan dan renggangan udara (gelombang longitudinal) yang merambat menembus lubang perforasi grille logam.',
    signalFlow:
      'Dorongan Voice Coil -> Vibrasi Diafragma Cone (5) -> Grille Logam (6) -> Gelombang Akustik Ruangan.',
    items: [
      'Pada simulasi 3D, cone bergetar nyata dan memancarkan cincin gelombang akustik hijau saat audio aktif.',
      'Berhenti bergetar seketika apabila Sirkuit Proteksi trip.',
    ],
    cam: [16.8, 4.5, 5.2],
    target: [16.6, 2.2, 0],
  },
};

export const CAMERA_PRESETS: Record<
  Exclude<CameraPreset, 'closeup'>,
  { cam: [number, number, number]; target: [number, number, number] }
> = {
  overview: {
    cam: [0, 13.5, 27],
    target: [0.5, 1.3, 0],
  },
  sensors: {
    cam: [5.8, 5.8, 10.2],
    target: [6.8, 1.0, 0.7],
  },
};
