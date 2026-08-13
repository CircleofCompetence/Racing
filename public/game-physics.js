export const JET_ALTITUDE = 6.2;
export const GROUND_CLEARANCE = .7;

export function flightMotionStep(currentAltitude, currentVelocity, jetActive, dt) {
  const targetAltitude = jetActive ? JET_ALTITUDE : 0;
  const response = jetActive ? 3.8 : 3.2;
  const acceleration = (targetAltitude - currentAltitude) * response * response - 2 * response * currentVelocity;
  let velocity = currentVelocity + acceleration * dt;
  let altitude = currentAltitude + velocity * dt;
  if (jetActive && altitude >= JET_ALTITUDE) { altitude = JET_ALTITUDE; velocity = 0; }
  if (!jetActive && altitude < .025 && Math.abs(velocity) < .35) { altitude = 0; velocity = 0; }
  return { altitude: Math.max(0, altitude), velocity };
}

export function groundObstacleCanDamage({ jetTimer, flightY, jumpY, impactY, jumpable, clearance }) {
  if (jetTimer > 0 || flightY > GROUND_CLEARANCE) return false;
  return !(jumpable && jumpY + impactY > clearance);
}

export function fallingFruitSpawnY(targetY, initialVelocity, gravity, travelTime) {
  return targetY - initialVelocity * travelTime + .5 * gravity * travelTime * travelTime;
}

export function fruitHitsCar(fruit, car) {
  return Math.abs(fruit.z - car.z) < fruit.radius + 1.05 &&
    Math.abs(fruit.x - car.x) < fruit.radius + .45 &&
    Math.abs(fruit.y - car.y) < fruit.radius + .58;
}

export function impactDirections(sourceX, carX, centerDirection=1) {
  const delta = sourceX - carX;
  const carDirection = Math.abs(delta) < .12 ? Math.sign(centerDirection) || 1 : delta > 0 ? -1 : 1;
  return { carDirection, objectDirection: -carDirection };
}
