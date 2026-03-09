export const MODULES = [
  // ── RECON ────────────────────────────────────────────────────
  { id:'syn_scan',   name:'TCP SYN Scan',        category:'recon',       risk:'LOW',      icon:'Radar',        description:'Escaneo sigiloso TCP SYN (half-open) para descubrir puertos abiertos' },
  { id:'udp_scan',   name:'UDP Port Scan',        category:'recon',       risk:'MEDIUM',   icon:'Wifi',         description:'Escaneo UDP para servicios DNS, SNMP, DHCP' },
  { id:'xmas_scan',  name:'XMAS Scan',            category:'recon',       risk:'MEDIUM',   icon:'TreePine',     description:'Scan con flags FIN+PSH+URG para evasión básica' },
  { id:'null_scan',  name:'NULL Scan',            category:'recon',       risk:'LOW',      icon:'Circle',       description:'Scan sin flags TCP para sistemas Unix/Linux' },
  { id:'fin_scan',   name:'FIN Scan',             category:'recon',       risk:'LOW',      icon:'Flag',         description:'Scan con flag FIN para bypass de firewalls' },
  { id:'os_fp',      name:'OS Fingerprinting',    category:'recon',       risk:'MEDIUM',   icon:'Cpu',          description:'Identificación de SO mediante TCP/IP fingerprinting' },
  { id:'banner',     name:'Banner Grabbing',      category:'recon',       risk:'LOW',      icon:'FileText',     description:'Captura de banners para identificar versiones' },
  { id:'svc_enum',   name:'Service Enumeration',  category:'recon',       risk:'LOW',      icon:'Search',       description:'Enumeración con scripts NSE' },
  // ── FINGERPRINT ──────────────────────────────────────────────
  { id:'os_detect',   name:'OS Detection',          category:'fingerprint', risk:'LOW',    icon:'Cpu',          description:'Detección profunda de SO: TTL, TCP/IP fingerprinting, nmap -O' },
  { id:'hw_info',     name:'Hardware Info',          category:'fingerprint', risk:'LOW',    icon:'HardDrive',    description:'Información de hardware vía SNMP: interfaces, CPU, fabricante' },
  { id:'sw_versions', name:'Software Versions',      category:'fingerprint', risk:'LOW',    icon:'Package',      description:'Versiones exactas de servicios y detección de CVEs conocidos' },
  { id:'smb_enum',    name:'SMB/Windows Enum',       category:'fingerprint', risk:'MEDIUM', icon:'Monitor',      description:'Enumeración SMB: versión Windows, shares, dominio, ms17-010' },
  { id:'web_tech',    name:'Web Tech Detection',     category:'fingerprint', risk:'LOW',    icon:'Globe',        description:'Stack web completo: servidor, CMS, frameworks, cabeceras de seguridad' },
  { id:'vuln_scan',   name:'Vulnerability Scan',     category:'fingerprint', risk:'HIGH',   icon:'ShieldAlert',  description:'Escaneo de CVEs con nmap --script vuln: Heartbleed, EternalBlue, etc.' },

  // ── FLOOD ────────────────────────────────────────────────────
  { id:'syn_flood',  name:'SYN Flood',            category:'flood',       risk:'CRITICAL', icon:'Zap',          description:'Inundación SYN para agotar conexiones TCP' },
  { id:'udp_flood',  name:'UDP Flood',            category:'flood',       risk:'CRITICAL', icon:'Radio',        description:'Inundación UDP a puertos aleatorios' },
  { id:'icmp_flood', name:'ICMP Flood',           category:'flood',       risk:'HIGH',     icon:'Activity',     description:'Inundación ICMP (Ping Flood)' },
  { id:'http_flood', name:'HTTP Flood',           category:'flood',       risk:'CRITICAL', icon:'Globe',        description:'Peticiones HTTP concurrentes para saturar servidor' },
  { id:'slowloris',  name:'Slowloris Attack',     category:'flood',       risk:'HIGH',     icon:'Clock',        description:'Ataque lento manteniendo conexiones HTTP abiertas' },
  { id:'fragflood',  name:'Fragment Flood',       category:'flood',       risk:'CRITICAL', icon:'Layers',       description:'Inundación de fragmentos IP para saturar reasemblaje' },
  // ── BRUTE FORCE ──────────────────────────────────────────────
  { id:'ssh_brute',  name:'SSH Brute Force',      category:'brute_force', risk:'HIGH',     icon:'Terminal',     description:'Fuerza bruta contra servicio SSH' },
  { id:'ftp_brute',  name:'FTP Brute Force',      category:'brute_force', risk:'HIGH',     icon:'FolderOpen',   description:'Fuerza bruta contra servicio FTP' },
  { id:'http_auth',  name:'HTTP Auth Brute',      category:'brute_force', risk:'HIGH',     icon:'Lock',         description:'Fuerza bruta HTTP Basic Auth' },
  { id:'rdp_brute',  name:'RDP Brute Force',      category:'brute_force', risk:'HIGH',     icon:'Monitor',      description:'Fuerza bruta contra RDP (Terminal Services)' },
  { id:'snmp_brute', name:'SNMP Community Brute', category:'brute_force', risk:'MEDIUM',   icon:'Network',      description:'Fuerza bruta de community strings SNMP' },
  { id:'smb_brute',  name:'SMB Auth Brute',       category:'brute_force', risk:'HIGH',     icon:'HardDrive',    description:'Fuerza bruta contra autenticación SMB/CIFS' },
  // ── PROTOCOL ─────────────────────────────────────────────────
  { id:'arp_spoof',  name:'ARP Spoofing',         category:'protocol',    risk:'CRITICAL', icon:'Route',        description:'Envenenamiento de caché ARP para interceptar tráfico' },
  { id:'vlan_hop',   name:'VLAN Hopping',         category:'protocol',    risk:'HIGH',     icon:'GitBranch',    description:'Double-tagging 802.1Q para saltar entre VLANs' },
  { id:'ipv6_flood', name:'IPv6 ND Flood',        category:'protocol',    risk:'HIGH',     icon:'Boxes',        description:'Flood de Neighbor Discovery IPv6' },
  { id:'frag_attack',name:'Teardrop Attack',      category:'protocol',    risk:'CRITICAL', icon:'Scissors',     description:'Fragmentos solapados para crash de pila TCP/IP' },
  { id:'tcp_reset',  name:'TCP RST Injection',    category:'protocol',    risk:'HIGH',     icon:'XCircle',      description:'Inyección de paquetes RST para cerrar conexiones' },
  // ── WEB ──────────────────────────────────────────────────────
  { id:'sqli',       name:'SQL Injection',        category:'web',         risk:'CRITICAL', icon:'Database',     description:'Inyección SQL con sqlmap + payloads manuales' },
  { id:'xss',        name:'XSS Attack',           category:'web',         risk:'HIGH',     icon:'Code',         description:'Cross-Site Scripting con XSStrike + mutaciones' },
  { id:'lfi_rfi',    name:'LFI/RFI',              category:'web',         risk:'CRITICAL', icon:'FileCode',     description:'Local/Remote File Inclusion con path traversal' },
  { id:'dir_trav',   name:'Directory Traversal',  category:'web',         risk:'HIGH',     icon:'FolderTree',   description:'Path traversal para acceder fuera del webroot' },
  { id:'ssrf',       name:'SSRF Probing',         category:'web',         risk:'HIGH',     icon:'RefreshCw',    description:'Server-Side Request Forgery contra metadata endpoints' },
  { id:'http_smug',  name:'HTTP Smuggling',       category:'web',         risk:'CRITICAL', icon:'ArrowLeftRight',description:'HTTP Request Smuggling CL.TE / TE.CL' },
  // ── DNS ──────────────────────────────────────────────────────
  { id:'dns_amplif', name:'DNS Amplification',    category:'dns',         risk:'CRITICAL', icon:'Volume2',      description:'Amplificación DNS usando queries ANY spoofeadas' },
  { id:'dns_tunnel', name:'DNS Tunneling',        category:'dns',         risk:'HIGH',     icon:'ArrowDown',    description:'Túnel DNS para exfiltración de datos' },
  { id:'dns_poison', name:'DNS Cache Poison',     category:'dns',         risk:'CRITICAL', icon:'Skull',        description:'Envenenamiento de caché DNS con respuestas forjadas' },
  { id:'dga_query',  name:'DGA Domain Queries',   category:'dns',         risk:'MEDIUM',   icon:'Hash',         description:'Queries a dominios generados por algoritmo DGA' },
  // ── EVASION ──────────────────────────────────────────────────
  { id:'ttl_manip',  name:'TTL Manipulation',     category:'evasion',     risk:'MEDIUM',   icon:'Timer',        description:'Manipulación de TTL para evasión de firewall' },
  { id:'decoy_scan', name:'Decoy Scanning',       category:'evasion',     risk:'MEDIUM',   icon:'Users',        description:'Scan con IPs decoy para ocultar origen real' },
  { id:'timing_ev',  name:'Timing Evasion',       category:'evasion',     risk:'LOW',      icon:'AlarmClock',   description:'Scan ultra lento T0 para evadir detección' },
  { id:'enc_payload',name:'Encrypted Payload',    category:'evasion',     risk:'HIGH',     icon:'ShieldCheck',  description:'Payloads sobre TLS 1.3 / HTTPS cifrado' },
  { id:'poly_payload',name:'Polymorphic Payload', category:'evasion',     risk:'HIGH',     icon:'Shuffle',      description:'7 mutaciones polimórficas de XSS (case, encoding, unicode)' },
  // ── FIREWALL ─────────────────────────────────────────────────
  { id:'policy_chk', name:'Policy Compliance',    category:'firewall',    risk:'LOW',      icon:'ClipboardCheck',description:'Verificación de puertos que deberían estar cerrados' },
  { id:'acl_bypass', name:'ACL Bypass',           category:'firewall',    risk:'HIGH',     icon:'ShieldOff',    description:'Bypass de ACL mediante source port spoofing' },
  { id:'admin_probe',name:'Admin Interface Probe',category:'firewall',    risk:'MEDIUM',   icon:'Settings',     description:'Sondeo de interfaces admin Fortinet (8443, 10443)' },
  { id:'nat_bypass', name:'NAT Bypass',           category:'firewall',    risk:'HIGH',     icon:'ArrowUpRight', description:'UDP hole punching y túnel IPv6 sobre IPv4' },
];

export const CATEGORIES = {
  fingerprint: { name:'Fingerprinting',  color:'#30d158', icon:'Fingerprint' },
  recon:       { name:'Reconocimiento',  color:'#0a84ff', icon:'Search'  },
  flood:       { name:'Flood / DoS',     color:'#ff453a', icon:'Zap'     },
  brute_force: { name:'Fuerza Bruta',    color:'#ff9f0a', icon:'Key'     },
  protocol:    { name:'Protocolo',       color:'#bf5af2', icon:'Network' },
  web:         { name:'Web Attacks',     color:'#ff375f', icon:'Globe'   },
  dns:         { name:'DNS',             color:'#30d158', icon:'Globe'   },
  evasion:     { name:'Evasión',         color:'#64d2ff', icon:'Eye'     },
  firewall:    { name:'Firewall',        color:'#ffd60a', icon:'Shield'  },
};

export const RISK_COLORS = {
  LOW:      '#30d158',
  MEDIUM:   '#ff9f0a',
  HIGH:     '#ff375f',
  CRITICAL: '#ff453a',
};

export const STATUS_CONFIG = {
  BLOCKED:  { color:'#30d158', label:'BLOQUEADO',  score:100, emoji:'🛡️' },
  DETECTED: { color:'#ff9f0a', label:'DETECTADO',  score:60,  emoji:'👁️' },
  PARTIAL:  { color:'#ff375f', label:'PARCIAL',    score:35,  emoji:'⚠️' },
  PASSED:   { color:'#ff453a', label:'VULNERABL',  score:0,   emoji:'🚨' },
  ERROR:    { color:'#64d2ff', label:'ERROR',      score:null,emoji:'❌' },
};
