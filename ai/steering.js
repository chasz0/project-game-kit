// Autonomous agent steering behaviors and force integration.
// Agent shape: { x, y, vx, vy }
//
//   const force = steering.orbit(enemy, player, 180, enemy.maxSpeed);
//   steering.applyForce(enemy, force, enemy.maxForce, enemy.maxSpeed, dt);

const clampVec = (out, maxLen) => {
  const mSq = out.x * out.x + out.y * out.y;
  if (mSq > maxLen * maxLen && mSq > 0) {
    const scale = maxLen / Math.sqrt(mSq);
    out.x *= scale;
    out.y *= scale;
  }
  return out;
};

export const steering = {
  seek(agent, target, maxSpeed, out = { x: 0, y: 0 }) {
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    const distSq = dx * dx + dy * dy;

    if (distSq === 0) {
      out.x = 0;
      out.y = 0;
      return out;
    }

    const inv = maxSpeed / Math.sqrt(distSq);
    out.x = dx * inv - (agent.vx || 0);
    out.y = dy * inv - (agent.vy || 0);
    return out;
  },

  flee(agent, threat, maxSpeed, out = { x: 0, y: 0 }) {
    const dx = agent.x - threat.x;
    const dy = agent.y - threat.y;
    const distSq = dx * dx + dy * dy;

    if (distSq === 0) {
      out.x = maxSpeed;
      out.y = 0;
      return out;
    }

    const inv = maxSpeed / Math.sqrt(distSq);
    out.x = dx * inv - (agent.vx || 0);
    out.y = dy * inv - (agent.vy || 0);
    return out;
  },

  arrive(agent, target, maxSpeed, slowRadius = 100, out = { x: 0, y: 0 }) {
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.001) {
      out.x = -(agent.vx || 0);
      out.y = -(agent.vy || 0);
      return out;
    }

    const speed = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed;
    const inv = speed / dist;
    out.x = dx * inv - (agent.vx || 0);
    out.y = dy * inv - (agent.vy || 0);
    return out;
  },

  pursue(agent, target, maxSpeed, maxPrediction = 0.5, out = { x: 0, y: 0 }) {
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.sqrt((agent.vx || 0) ** 2 + (agent.vy || 0) ** 2);
    const lookAhead = speed <= dist / maxPrediction ? maxPrediction : dist / (speed || 1);

    const future = {
      x: target.x + (target.vx || 0) * lookAhead,
      y: target.y + (target.vy || 0) * lookAhead
    };
    return this.seek(agent, future, maxSpeed, out);
  },

  // Steers the agent to circle around target at a fixed standoff radius.
  orbit(agent, target, radius, maxSpeed, clockwise = true, out = { x: 0, y: 0 }) {
    const dx = agent.x - target.x;
    const dy = agent.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const nx = dx / dist;
    const ny = dy / dist;

    // Tangent direction around the target
    const tx = clockwise ? -ny : ny;
    const ty = clockwise ? nx : -nx;

    // Radial correction pulls agent back toward the orbit ring
    const radialError = (radius - dist) / Math.max(1, radius);
    const vx = tx + nx * radialError * 1.5;
    const vy = ty + ny * radialError * 1.5;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;

    out.x = (vx / len) * maxSpeed - (agent.vx || 0);
    out.y = (vy / len) * maxSpeed - (agent.vy || 0);
    return out;
  },

  separate(agent, neighbors, desiredSeparation = 32, maxSpeed = 200, out = { x: 0, y: 0 }) {
    const sepSq = desiredSeparation * desiredSeparation;
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const other = neighbors[i];
      if (other === agent) continue;
      const dx = agent.x - other.x;
      const dy = agent.y - other.y;
      const dSq = dx * dx + dy * dy;

      if (dSq > 0 && dSq < sepSq) {
        const d = Math.sqrt(dSq);
        sumX += (dx / d) / d;
        sumY += (dy / d) / d;
        count++;
      }
    }

    if (count === 0) {
      out.x = 0;
      out.y = 0;
      return out;
    }

    const len = Math.sqrt(sumX * sumX + sumY * sumY);
    if (len > 0) {
      out.x = (sumX / len) * maxSpeed - (agent.vx || 0);
      out.y = (sumY / len) * maxSpeed - (agent.vy || 0);
    } else {
      out.x = 0;
      out.y = 0;
    }
    return out;
  },

  // Computes combined separation, alignment, and cohesion in a single pass.
  flock(agent, neighbors, {
    neighborRadius = 70,
    separationRadius = 28,
    maxSpeed = 200,
    sepWeight = 1.6,
    alignWeight = 1.0,
    cohWeight = 0.8
  } = {}, out = { x: 0, y: 0 }) {
    const nSq = neighborRadius * neighborRadius;
    const sSq = separationRadius * separationRadius;

    let sepX = 0, sepY = 0, sepCount = 0;
    let aliX = 0, aliY = 0;
    let cohX = 0, cohY = 0;
    let count = 0;

    for (let i = 0; i < neighbors.length; i++) {
      const other = neighbors[i];
      if (other === agent) continue;

      const dx = agent.x - other.x;
      const dy = agent.y - other.y;
      const dSq = dx * dx + dy * dy;

      if (dSq > 0 && dSq < nSq) {
        aliX += other.vx || 0;
        aliY += other.vy || 0;
        cohX += other.x;
        cohY += other.y;
        count++;

        if (dSq < sSq) {
          const d = Math.sqrt(dSq);
          sepX += (dx / d) / d;
          sepY += (dy / d) / d;
          sepCount++;
        }
      }
    }

    out.x = 0;
    out.y = 0;

    if (sepCount > 0) {
      const len = Math.sqrt(sepX * sepX + sepY * sepY) || 1;
      out.x += ((sepX / len) * maxSpeed - (agent.vx || 0)) * sepWeight;
      out.y += ((sepY / len) * maxSpeed - (agent.vy || 0)) * sepWeight;
    }

    if (count > 0) {
      const aLen = Math.sqrt(aliX * aliX + aliY * aliY);
      if (aLen > 0) {
        out.x += ((aliX / aLen) * maxSpeed - (agent.vx || 0)) * alignWeight;
        out.y += ((aliY / aLen) * maxSpeed - (agent.vy || 0)) * alignWeight;
      }

      const cx = cohX / count - agent.x;
      const cy = cohY / count - agent.y;
      const cLen = Math.sqrt(cx * cx + cy * cy);
      if (cLen > 0) {
        out.x += ((cx / cLen) * maxSpeed - (agent.vx || 0)) * cohWeight;
        out.y += ((cy / cLen) * maxSpeed - (agent.vy || 0)) * cohWeight;
      }
    }

    return out;
  },

  // Clamps steering force, integrates velocity, and advances position by dt (ms).
  applyForce(agent, force, maxForce, maxSpeed, dt) {
    const dtSec = dt / 1000;
    clampVec(force, maxForce);

    agent.vx = (agent.vx || 0) + force.x * dtSec;
    agent.vy = (agent.vy || 0) + force.y * dtSec;

    const spdSq = agent.vx * agent.vx + agent.vy * agent.vy;
    if (spdSq > maxSpeed * maxSpeed && spdSq > 0) {
      const scale = maxSpeed / Math.sqrt(spdSq);
      agent.vx *= scale;
      agent.vy *= scale;
    }

    agent.x += agent.vx * dtSec;
    agent.y += agent.vy * dtSec;
    return agent;
  }
};