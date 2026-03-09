// NetProbe - Perfiles de escaneo predefinidos

export const PROFILES = [
  {
    id:          'recon_basico',
    name:        'Reconocimiento Básico',
    description: 'Puertos, banners y SO. Perfecto como primer paso.',
    icon:        '🔍',
    color:       '#0a84ff',
    risk:        'LOW',
    intensity:   2,
    duration:    30,
    modules: [
      'syn_scan', 'banner', 'svc_enum', 'os_detect',
    ],
  },
  {
    id:          'fingerprint_completo',
    name:        'Fingerprinting Completo',
    description: 'Identificación exhaustiva: OS, hardware, software, CVEs y servicios web.',
    icon:        '🖨️',
    color:       '#30d158',
    risk:        'MEDIUM',
    intensity:   3,
    duration:    60,
    modules: [
      'syn_scan', 'banner', 'os_detect', 'hw_info',
      'sw_versions', 'web_tech', 'smb_enum', 'vuln_scan',
    ],
  },
  {
    id:          'auditoria_firewall',
    name:        'Auditoría de Firewall',
    description: 'Evalúa política, bypass de ACL, interfaces admin y evasión de detección.',
    icon:        '🛡️',
    color:       '#ffd60a',
    risk:        'MEDIUM',
    intensity:   3,
    duration:    45,
    modules: [
      'policy_chk', 'acl_bypass', 'admin_probe', 'nat_bypass',
      'ttl_manip', 'decoy_scan', 'timing_ev', 'fin_scan',
    ],
  },
  {
    id:          'pentest_web',
    name:        'Pentest Web',
    description: 'SQLi, XSS, LFI, SSRF y smuggling. Para aplicaciones HTTP/S.',
    icon:        '🌐',
    color:       '#ff375f',
    risk:        'HIGH',
    intensity:   3,
    duration:    60,
    modules: [
      'web_tech', 'vuln_scan', 'sqli', 'xss',
      'lfi_rfi', 'dir_trav', 'ssrf', 'http_smug',
    ],
  },
  {
    id:          'auditoria_windows',
    name:        'Auditoría Windows / SMB',
    description: 'SMB, RDP, EternalBlue, shares y fuerza bruta de credenciales Windows.',
    icon:        '🪟',
    color:       '#bf5af2',
    risk:        'HIGH',
    intensity:   3,
    duration:    60,
    modules: [
      'smb_enum', 'smb_brute', 'rdp_brute', 'vuln_scan',
      'os_detect', 'hw_info',
    ],
  },
  {
    id:          'resistencia_dos',
    name:        'Resistencia DoS',
    description: 'Prueba de resistencia ante SYN flood, UDP flood, ICMP, HTTP y Slowloris.',
    icon:        '⚡',
    color:       '#ff453a',
    risk:        'CRITICAL',
    intensity:   4,
    duration:    30,
    modules: [
      'syn_flood', 'udp_flood', 'icmp_flood', 'http_flood', 'slowloris',
    ],
  },
  {
    id:          'sigiloso',
    name:        'Escaneo Sigiloso',
    description: 'Técnicas de evasión máxima: timing lento, decoys, TTL y payloads cifrados.',
    icon:        '👤',
    color:       '#64d2ff',
    risk:        'MEDIUM',
    intensity:   1,
    duration:    120,
    modules: [
      'null_scan', 'fin_scan', 'xmas_scan', 'timing_ev',
      'ttl_manip', 'decoy_scan', 'enc_payload',
    ],
  },
];

export const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
export const RISK_LABELS = {
  LOW:      { label: 'Bajo',     color: '#30d158' },
  MEDIUM:   { label: 'Medio',    color: '#ffd60a' },
  HIGH:     { label: 'Alto',     color: '#ff9f0a' },
  CRITICAL: { label: 'Crítico',  color: '#ff453a' },
};
