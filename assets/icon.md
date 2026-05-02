<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#6D28D9"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="120" fill="url(#bg)"/>

  <!-- Outer sync ring -->
  <circle
    cx="512"
    cy="512"
    r="365"
    fill="none"
    stroke="#0A0A0A"
    stroke-width="26"
    stroke-linecap="round"
    stroke-dasharray="1800 220"
    transform="rotate(-18 512 512)"
  />

  <!-- Inner ring -->
  <circle
    cx="512"
    cy="512"
    r="270"
    fill="none"
    stroke="#0A0A0A"
    stroke-width="18"
    stroke-linecap="round"
    stroke-dasharray="1280 180"
    transform="rotate(24 512 512)"
  />

  <!-- Upper sharp sync stroke -->
  <path
    d="M520 400 L735 315 L620 420 L785 455"
    fill="none"
    stroke="#0A0A0A"
    stroke-width="18"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Lower sharp sync stroke -->
  <path
    d="M295 620 L520 585 L385 680 L610 655"
    fill="none"
    stroke="#0A0A0A"
    stroke-width="18"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Bridge stroke (connects both flows) -->
  <path
    d="M250 540 L420 540"
    fill="none"
    stroke="#0A0A0A"
    stroke-width="18"
    stroke-linecap="round"
  />
</svg>
