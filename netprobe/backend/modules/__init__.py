from .recon import run_recon_module
from .flood import run_flood_module
from .brute_force import run_brute_force_module
from .protocol import run_protocol_module
from .web_attacks import run_web_module
from .dns_attacks import run_dns_module
from .evasion import run_evasion_module
from .firewall import run_firewall_module
from .fingerprint import run_fingerprint_module

MODULE_RUNNERS = {
    # Recon
    "syn_scan": ("recon", run_recon_module),
    "udp_scan": ("recon", run_recon_module),
    "xmas_scan": ("recon", run_recon_module),
    "null_scan": ("recon", run_recon_module),
    "fin_scan": ("recon", run_recon_module),
    "os_fp": ("recon", run_recon_module),
    "banner": ("recon", run_recon_module),
    "svc_enum": ("recon", run_recon_module),
    # Flood
    "syn_flood": ("flood", run_flood_module),
    "udp_flood": ("flood", run_flood_module),
    "icmp_flood": ("flood", run_flood_module),
    "http_flood": ("flood", run_flood_module),
    "slowloris": ("flood", run_flood_module),
    "fragflood": ("flood", run_flood_module),
    # Brute Force
    "ssh_brute": ("brute_force", run_brute_force_module),
    "ftp_brute": ("brute_force", run_brute_force_module),
    "http_auth": ("brute_force", run_brute_force_module),
    "rdp_brute": ("brute_force", run_brute_force_module),
    "snmp_brute": ("brute_force", run_brute_force_module),
    "smb_brute": ("brute_force", run_brute_force_module),
    # Protocol
    "arp_spoof": ("protocol", run_protocol_module),
    "vlan_hop": ("protocol", run_protocol_module),
    "ipv6_flood": ("protocol", run_protocol_module),
    "frag_attack": ("protocol", run_protocol_module),
    "tcp_reset": ("protocol", run_protocol_module),
    # Web
    "sqli": ("web", run_web_module),
    "xss": ("web", run_web_module),
    "lfi_rfi": ("web", run_web_module),
    "dir_trav": ("web", run_web_module),
    "ssrf": ("web", run_web_module),
    "http_smug": ("web", run_web_module),
    # DNS
    "dns_amplif": ("dns", run_dns_module),
    "dns_tunnel": ("dns", run_dns_module),
    "dns_poison": ("dns", run_dns_module),
    "dga_query": ("dns", run_dns_module),
    # Evasion
    "ttl_manip": ("evasion", run_evasion_module),
    "decoy_scan": ("evasion", run_evasion_module),
    "timing_ev": ("evasion", run_evasion_module),
    "enc_payload": ("evasion", run_evasion_module),
    "poly_payload": ("evasion", run_evasion_module),
    # Fingerprint
    "os_detect":   ("fingerprint", run_fingerprint_module),
    "hw_info":     ("fingerprint", run_fingerprint_module),
    "sw_versions": ("fingerprint", run_fingerprint_module),
    "smb_enum":    ("fingerprint", run_fingerprint_module),
    "web_tech":    ("fingerprint", run_fingerprint_module),
    "vuln_scan":   ("fingerprint", run_fingerprint_module),
    # Firewall
    "policy_chk": ("firewall", run_firewall_module),
    "acl_bypass": ("firewall", run_firewall_module),
    "admin_probe": ("firewall", run_firewall_module),
    "nat_bypass": ("firewall", run_firewall_module),
}
