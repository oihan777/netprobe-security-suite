export const formatDate = (d) =>
  new Date(d).toLocaleString('es-ES', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

export const getScoreColor = (s) =>
  s >= 75 ? '#30d158' : s >= 50 ? '#ffd60a' : s >= 25 ? '#ff9f0a' : '#ff453a';

export const getScoreLabel = (s) =>
  s >= 75 ? 'SEGURO' : s >= 50 ? 'MODERADO' : s >= 25 ? 'RIESGO' : 'CRÍTICO';

export const getStatusColor = (status) => ({
  BLOCKED: '#30d158', DETECTED: '#ff9f0a', PARTIAL: '#ff375f', PASSED: '#ff453a', ERROR: '#64d2ff',
}[status] || '#ffffff');
