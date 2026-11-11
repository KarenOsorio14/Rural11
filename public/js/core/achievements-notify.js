'use strict';
// Evalúa los logros del estudiante y avisa con una notificación por cada uno nuevo.
// Nunca interrumpe el flujo de la actividad: si algo falla, solo se registra en consola.

import { notify } from './notifications.js';
import { evaluateAchievements } from '../modules/gamification/gamification.service.js';

export async function checkAchievements(userId) {
  try {
    const earned = await evaluateAchievements(userId);
    const badges = earned.filter((item) => item.kind === 'badge');
    const rewards = earned.filter((item) => item.kind === 'reward');
    if (earned.length > 2) {
      // Varios logros a la vez (por ejemplo, un estudiante con práctica previa): un solo aviso.
      const parts = [];
      if (badges.length) parts.push(`${badges.length} ${badges.length === 1 ? 'insignia' : 'insignias'}`);
      if (rewards.length) parts.push(`${rewards.length} ${rewards.length === 1 ? 'recompensa' : 'recompensas'}`);
      notify({ type: 'success', title: `¡Ganaste ${parts.join(' y ')}!`, message: 'Míralas en tu Perfil.' });
    } else {
      for (const item of earned) {
        notify({
          type: 'success',
          title: item.kind === 'badge' ? `¡Nueva insignia! ${item.name}` : `¡Nueva recompensa! ${item.name}`,
          message: item.kind === 'badge' ? 'Mírala en tu Perfil.' : 'Está en tu colección del Perfil.'
        });
      }
    }
    return earned;
  } catch (error) {
    console.warn('No se pudieron revisar los logros:', error);
    return [];
  }
}
