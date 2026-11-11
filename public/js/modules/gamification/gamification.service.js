'use strict';
// Validación y otorgamiento automático de insignias (HU_21) y recompensas (HU_22).

import { getAttemptsByUser } from '../questionnaires/questionnaires.repository.js';
import { BADGES, REWARDS, occurrences } from './catalog.js';
import { buildStats } from './stats.js';
import { addAchievement, getAchievementsByUser, achievementId } from './gamification.repository.js';

// Evita que dos evaluaciones simultáneas del mismo estudiante se pisen.
const running = new Map();

async function evaluate(userId) {
  const [attempts, owned] = await Promise.all([getAttemptsByUser(userId), getAchievementsByUser(userId)]);
  const stats = buildStats(attempts);
  const have = new Set(owned.map((item) => item.id));
  const earned = [];

  const grant = async (kind, def, occurrence) => {
    const id = achievementId(userId, kind, def.id, occurrence);
    if (have.has(id)) return;
    const record = {
      id, userId, kind, itemId: def.id, occurrence, name: def.name,
      createdAt: new Date().toISOString()
    };
    // dbAdd falla si el id ya existe: la base de datos también impide duplicados.
    if (await addAchievement(record)) {
      have.add(id);
      earned.push({ ...record, image: def.image });
    }
  };

  for (const badge of BADGES) {
    const [value, target] = badge.progress(stats);
    if (value >= target) await grant('badge', badge, 1);
  }
  for (const reward of REWARDS) {
    const total = occurrences(reward, stats);
    for (let n = 1; n <= total; n += 1) await grant('reward', reward, n);
  }
  return earned;
}

/** Revisa los objetivos del estudiante y otorga lo que falte. Devuelve lo recién obtenido. */
export function evaluateAchievements(userId) {
  const previous = running.get(userId) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => evaluate(userId));
  running.set(userId, next);
  next.finally(() => { if (running.get(userId) === next) running.delete(userId); }).catch(() => {});
  return next;
}

function describe(def, kind, stats, owned) {
  const mine = owned.filter((item) => item.kind === kind && item.itemId === def.id);
  const [value, target] = def.progress(stats);
  return {
    id: def.id, name: def.name, image: def.image, description: def.description,
    goal: def.goal, reusable: Boolean(def.reusable),
    earned: mine.length > 0,
    count: mine.length,
    earnedAt: mine.length ? mine.map((m) => m.createdAt).sort()[0] : null,
    progress: Math.min(value, target), target
  };
}

/** Catálogo con el estado de cada insignia y recompensa del estudiante. */
export async function getAchievementsOverview(userId) {
  const [attempts, owned] = await Promise.all([getAttemptsByUser(userId), getAchievementsByUser(userId)]);
  const stats = buildStats(attempts);
  return {
    stats,
    badges: BADGES.map((def) => describe(def, 'badge', stats, owned)),
    rewards: REWARDS.map((def) => describe(def, 'reward', stats, owned))
  };
}
